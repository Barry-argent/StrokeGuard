import os
import json
import logging
import math
import time
import asyncio
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, HTTPException, Path
from pydantic import BaseModel, field_validator
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import aiosqlite
from google import genai
from google.genai import types, errors
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# --- INITIALIZATION ---
load_dotenv()
genai_client = genai.Client()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Modern FastAPI lifespan event to handle async DB initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="StrokeGuard API Gateway", version="2.2.1", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE ENGINE (Now fully Asynchronous & Safe) ---
ALLOWED_TABLES = {"patients": "state", "profiles": "profile_data"}

async def init_db():
    async with aiosqlite.connect("strokeguard.db") as db:
        await db.execute("CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, state TEXT)")
        await db.execute("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, profile_data TEXT)")
        await db.commit()

async def get_db_row(table: str, entry_id: str) -> dict:
    if table not in ALLOWED_TABLES:
        raise ValueError("Invalid table name")
    col = ALLOWED_TABLES[table]
    async with aiosqlite.connect("strokeguard.db") as db:
        async with db.execute(f"SELECT {col} FROM {table} WHERE id=?", (str(entry_id),)) as cursor:
            row = await cursor.fetchone()
            return json.loads(row[0]) if row else {}

async def save_db_row(table: str, entry_id: str, data: dict):
    if table not in ALLOWED_TABLES:
        raise ValueError("Invalid table name")
    col = ALLOWED_TABLES[table]
    async with aiosqlite.connect("strokeguard.db") as db:
        await db.execute(f"INSERT OR REPLACE INTO {table} (id, {col}) VALUES (?, ?)", (str(entry_id), json.dumps(data)))
        await db.commit()

# --- CONSTANTS ---
MIN_BPM_READINGS = 30
CONSECUTIVE_GREEN_RESET_THRESHOLD = 3
PATIENT_ID_PATTERN = r"^[a-zA-Z0-9_-]{1,64}$"

# --- DATA MODELS ---
class ProfilePayload(BaseModel):
    patient_id: str
    name: str
    age: int
    history: str
    recent_activity: str
    emergency_contact: str

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        import re
        if not re.match(PATIENT_ID_PATTERN, v):
            raise ValueError("patient_id must be 1-64 alphanumeric characters, hyphens, or underscores.")
        return v

    @field_validator("emergency_contact")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.startswith("+") or not v[1:].isdigit():
            raise ValueError("emergency_contact must be in E.164 format, e.g. +2347069547832")
        return v

class VitalsPayload(BaseModel):
    patient_id: str
    mode: Optional[str] = "PASSIVE"
    pulse_rate_history: List[float]
    prv_score: float
    aha_lifestyle_score: int
    is_exercising: bool
    systolic: Optional[int] = 120
    diastolic: Optional[int] = 80
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        import re
        if not re.match(PATIENT_ID_PATTERN, v):
            raise ValueError("patient_id must be 1-64 alphanumeric characters, hyphens, or underscores.")
        return v

    @field_validator("pulse_rate_history")
    @classmethod
    def validate_bpm_history(cls, v: List[float]) -> List[float]:
        if len(v) < MIN_BPM_READINGS:
            raise ValueError(f"Need at least {MIN_BPM_READINGS} BPM readings. Got {len(v)}.")
        return v

class SOSPayload(BaseModel):
    patient_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        import re
        if not re.match(PATIENT_ID_PATTERN, v):
            raise ValueError("patient_id must be 1-64 alphanumeric characters, hyphens, or underscores.")
        return v

# --- TRIAGE & AI LOGIC ---
def calculate_rmssd(bpm_history: List[float]) -> float:
    """Calculates RMSSD (ms) for ultra-short-term HRV analysis."""
    if len(bpm_history) < 2:
        raise ValueError("Need at least 2 readings.")
    
    # Convert BPM to RR intervals in milliseconds
    rr_intervals = [60000.0 / bpm for bpm in bpm_history]
    
    # Calculate successive differences
    squared_diffs = []
    for i in range(1, len(rr_intervals)):
        diff = rr_intervals[i] - rr_intervals[i-1]
        squared_diffs.append(diff ** 2)
        
    # Root mean square
    return math.sqrt(sum(squared_diffs) / len(squared_diffs))

def calculate_composite_risk(aha: int, sys: int, dia: int, hrv_val: float, exercising: bool) -> str:
    # Failsafe fallback if None slips past Pydantic
    sys = sys or 120
    dia = dia or 80

    if sys >= 180 or dia >= 120:
        return "RED"
    if exercising:
        return "GREEN"
    if hrv_val < 20.0:
        hrv_stat = "RED"
    elif hrv_val < 40.0:
        hrv_stat = "YELLOW"
    else:
        hrv_stat = "GREEN"
    
    if hrv_stat == "RED":
        return "RED"
    if hrv_stat == "YELLOW":
        return "RED" if (sys >= 140 or dia >= 90 or aha < 50) else "YELLOW"
    return "YELLOW" if (sys >= 130 or dia > 80 or aha < 50) else "GREEN"

async def generate_ai_coach(patient_id: str, sys: int, dia: int, hrv: float, aha: int) -> str:
    profile = await get_db_row("profiles", patient_id)
    if not profile:
        profile = {"name": "Patient", "age": "Unknown", "history": "None", "recent_activity": "Unknown"}

    # Truncate history to avoid token bloat
    history_snippet = str(profile.get('history', 'None'))[-500:] 
    activity_snippet = str(profile.get('recent_activity', 'Unknown'))[-200:]

    system_instr = (
        "You are StrokeGuard AI. Analyze vitals vs history. Warm, calming tone. "
        "No diagnosis. No markdown. Detailed and comprehensive actionable next steps."
        )

    try:
        response = await genai_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f"Patient: {profile.get('name')}, {profile.get('age')}. "
                f"History (Recent): {history_snippet}. "
                f"Vitals: BP {sys}/{dia}, PRV {hrv:.1f}ms, AHA Score {aha}. "
                f"Current Context: {activity_snippet}. "
                "Task: Provide immediate triage advice for this Yellow state."
            ),
            config=types.GenerateContentConfig(system_instruction=system_instr),
        )
        return response.text.strip()
    
    except errors.APIError as api_err:
        logger.error("Gemini API Error for patient %s: %s", patient_id, api_err)
    except Exception as e:
        logger.error("Unexpected error in AI coach for patient %s: %s", patient_id, e)
    
    # Fallback response
    name = profile.get("name", "Patient")
    return (
        f"{name}, your vitals are slightly elevated. "
        "Please sit down, breathe slowly and deeply, and avoid strenuous activity."
    )

def _send_twilio_sync(msg: str, to_contact: str):
    """Synchronous Twilio wrapper to be run in a thread pool."""
    twilio_client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    twilio_client.messages.create(
        body=msg,
        from_=os.getenv("TWILIO_PHONE_NUMBER"),
        to=to_contact,
    )

async def send_emergency_sms(patient_id: str, sys: int, dia: int, hrv: float, lat: Optional[float], lng: Optional[float], emergency_contact: str):
    """Fires emergency protocol via Twilio using asyncio.to_thread to prevent blocking."""
    try:
        loc = f"https://www.google.com/maps?q={lat},{lng}" if lat and lng else "GPS Disabled"
        msg = (
            f"STROKEGUARD ALERT: Patient {patient_id}\n"
            f"Vitals: BP {sys}/{dia} | PRV {hrv:.1f}ms\n"
            f"Location: {loc}\n"
            "Please dispatch help immediately."
        )
        
        # Offload the blocking sync call to a separate thread
        await asyncio.to_thread(_send_twilio_sync, msg, emergency_contact)
        logger.info("Emergency SMS sent for patient %s to %s", patient_id, emergency_contact)

    except TwilioRestException as e:
        logger.error("Twilio SMS FAILED for patient %s (contact: %s): %s", patient_id, emergency_contact, e)
        latest_state = await get_db_row("patients", patient_id)
        latest_state["alert_failure"] = str(e)
        await save_db_row("patients", patient_id, latest_state)
    except Exception as e:
        logger.error("Unexpected error sending SMS for patient %s: %s", patient_id, e)

# --- API ENDPOINTS ---

@app.get("/")
async def root():
    return {
        "app": "StrokeGuard API Gateway",
        "status": "online",
        "version": "2.2.1"
    }
    
@app.post("/api/v1/patient/profile")
async def update_profile(payload: ProfilePayload):
    await save_db_row("profiles", payload.patient_id, payload.model_dump())
    return {"status": "success", "message": "Profile updated"}

@app.post("/api/v1/vitals/sync")
async def sync_vitals(payload: VitalsPayload, background_tasks: BackgroundTasks):
    profile = await get_db_row("profiles", payload.patient_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"No profile found for patient {payload.patient_id}. Register the patient first.",
        )

    try:
        rmssd = calculate_rmssd(payload.pulse_rate_history)
    except ValueError as e:
        logger.error("RMSSD calculation failed unexpectedly for %s: %s", payload.patient_id, e)
        rmssd = payload.prv_score

    if abs(rmssd - payload.prv_score) > 10:
        logger.warning("RMSSD mismatch for patient %s: backend=%.1f ms, client=%.1f ms", payload.patient_id, rmssd, payload.prv_score)

    final_status = calculate_composite_risk(
        payload.aha_lifestyle_score,
        payload.systolic,
        payload.diastolic,
        rmssd,
        payload.is_exercising,
    )

    prev = await get_db_row("patients", payload.patient_id)
    sms_sent = prev.get("sms_sent", False)
    ai_advice = prev.get("ai_advice", "")
    ai_last_gen_time = prev.get("ai_last_gen_time", 0)
    consecutive_green = prev.get("consecutive_green", 0)

    current_time = time.time()

    if final_status == "YELLOW":
        if current_time - ai_last_gen_time > 300:
            ai_advice = await generate_ai_coach(
                payload.patient_id, payload.systolic or 120, payload.diastolic or 80, rmssd, payload.aha_lifestyle_score
            )
            ai_last_gen_time = current_time
            logger.info("Generated new AI advice for %s", payload.patient_id)
        else:
            logger.info("Skipped AI generation for %s (on cooldown)", payload.patient_id)
        consecutive_green = 0

    if final_status == "RED":
        ai_advice = "CRITICAL ALERT: Severe vital escalation detected. Emergency contacts have been notified. Please seek immediate medical assistance."
        if not sms_sent:
            background_tasks.add_task(
                send_emergency_sms,
                payload.patient_id,
                payload.systolic or 120,
                payload.diastolic or 80,
                rmssd,
                payload.latitude,
                payload.longitude,
                profile["emergency_contact"],
            )
            sms_sent = True
        consecutive_green = 0

    if final_status == "GREEN":
        consecutive_green += 1
        if consecutive_green >= CONSECUTIVE_GREEN_RESET_THRESHOLD:
            sms_sent = False
            ai_advice = ""
            ai_last_gen_time = 0
            logger.info("Patient %s reached %d consecutive GREEN readings — episode reset.", payload.patient_id, consecutive_green)
    
    new_state = {
        "status": final_status,
        "hrv": rmssd,
        "hrv_client": payload.prv_score,
        "bp": f"{payload.systolic or 120}/{payload.diastolic or 80}",
        "sms_sent": sms_sent,
        "ai_advice": ai_advice,
        "ai_last_gen_time": ai_last_gen_time,
        "is_exercising": payload.is_exercising,
        "current_mode": payload.mode,
        "consecutive_green": consecutive_green,
        "alert_failure": prev.get("alert_failure") if final_status == "RED" else None,
    }
    
    await save_db_row("patients", payload.patient_id, new_state)

    logger.info(
        "SYNC [%s]: ID:%s | BP:%s/%s | HRV(backend)=%.1f HRV(client)=%.1f | Status:%s",
        payload.mode, payload.patient_id, payload.systolic, payload.diastolic, rmssd, payload.prv_score, final_status
    )
    
    # FIX APPLIED HERE: Mask the advice if the current reading is GREEN
    return {
        "status": final_status, 
        "ai_coach": ai_advice if final_status != "GREEN" else ""
    }

@app.get("/api/v1/patient/{patient_id}/status")
async def get_status(patient_id: str = Path(..., pattern=PATIENT_ID_PATTERN, description="Patient identifier")):
    state = await get_db_row("patients", patient_id)
    if not state:
        return {"status": "GREEN", "ui_action": "PASSIVE_MONITORING"}

    ui_action = "PASSIVE_MONITORING"
    if state.get("is_exercising"):
        ui_action = "EXERCISE_MODE_ACTIVE"
    elif state.get("status") == "YELLOW":
        ui_action = "SHOW_AI_ADVICE_MODAL"
    elif state.get("status") == "RED":
        ui_action = "TRIGGER_FAST_CHECK_EMERGENCY"

    return {**state, "ui_action": ui_action}

@app.post("/api/v1/patient/sos")
async def trigger_manual_sos(payload: SOSPayload, background_tasks: BackgroundTasks):
    profile = await get_db_row("profiles", payload.patient_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"No profile found for patient {payload.patient_id}.",
        )

    # 1. Update state to RED in DB
    prev = await get_db_row("patients", payload.patient_id)
    new_state = {
        **prev,
        "status": "RED",
        "sms_sent": True,
        "ai_advice": "EMERGENCY SOS ACTIVATED: Help has been summoned. Emergency contacts are being notified.",
        "ai_last_gen_time": time.time(),
    }
    await save_db_row("patients", payload.patient_id, new_state)

    # 2. Fire SMS background task
    background_tasks.add_task(
        send_emergency_sms,
        payload.patient_id,
        new_state.get("bp_sys", 120),  # Use existing BP if available
        new_state.get("bp_dia", 80),
        new_state.get("hrv", 0.0),
        payload.latitude,
        payload.longitude,
        profile["emergency_contact"],
    )

    logger.warning("MANUAL SOS TRIGGERED for patient %s", payload.patient_id)
    return {"status": "success", "message": "SOS protocol initiated"}


@app.get("/api/v1/patient/{patient_id}/health-tips")
async def get_health_tips(patient_id: str = Path(..., pattern=PATIENT_ID_PATTERN)):
    """Generate personalized daily health tasks using Gemini AI."""
    profile = await get_db_row("profiles", patient_id)
    state = await get_db_row("patients", patient_id)

    # Build context from whatever data we have
    name = profile.get("name", "Patient") if profile else "Patient"
    age = profile.get("age", "Unknown") if profile else "Unknown"
    history = profile.get("history", "None") if profile else "None"
    activity = profile.get("recent_activity", "Unknown") if profile else "Unknown"

    risk_level = state.get("status", "GREEN") if state else "GREEN"
    hrv = state.get("hrv", None) if state else None
    bp = state.get("bp", "120/80") if state else "120/80"
    risk_score = state.get("risk_score", None) if state else None

    # Construct a rich, contextual prompt
    vitals_context = f"Blood Pressure: {bp}."
    if hrv is not None:
        vitals_context += f" HRV (RMSSD): {hrv:.1f}ms."
    if risk_score is not None:
        vitals_context += f" Composite Risk Score: {risk_score}/100."

    system_instr = (
        "You are StrokeGuard AI, a personal health coach specializing in stroke prevention. "
        "Your role is to generate personalized, actionable daily health tasks for patients. "
        "Tasks must be specific, measurable, and achievable within a single day. "
        "Adapt the NUMBER of tasks to the patient's situation — more tasks for higher risk patients, "
        "fewer but still helpful tasks for healthy patients. Minimum 3, no maximum. "
        "Each task should directly relate to reducing stroke risk factors evident in the patient's data. "
        "Format your response EXACTLY as follows:\n"
        "First line: A single sentence summary of the patient's current health context.\n"
        "Then a blank line, followed by tasks as a markdown bullet list using '- ' prefix.\n"
        "Each task should be one concise sentence. Make them warm and encouraging.\n"
        "Do NOT include any other text, headers, or explanations."
    )

    prompt = (
        f"Patient: {name}, Age: {age}.\n"
        f"Medical History: {history}.\n"
        f"Activity Level: {activity}.\n"
        f"Current Risk Level: {risk_level}.\n"
        f"Current Vitals: {vitals_context}\n"
        f"\nGenerate personalized daily health tasks for today."
    )

    try:
        response = await genai_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system_instr),
        )
        tips_text = response.text.strip()
        logger.info("Generated health tips for patient %s (risk: %s)", patient_id, risk_level)

    except errors.APIError as api_err:
        logger.error("Gemini API Error for health tips [%s]: %s", patient_id, api_err)
        tips_text = (
            f"Welcome back, {name}. Here are your daily wellness goals.\n\n"
            "- Drink at least 8 glasses of water throughout the day.\n"
            "- Take a 15-minute walk at a comfortable pace.\n"
            "- Check and log your blood pressure.\n"
            "- Practice 5 minutes of deep breathing exercises.\n"
            "- Eat at least 2 servings of fruits or vegetables with each meal."
        )
    except Exception as e:
        logger.error("Unexpected error generating health tips for %s: %s", patient_id, e)
        tips_text = (
            f"Welcome back, {name}. Here are your daily wellness goals.\n\n"
            "- Drink at least 8 glasses of water throughout the day.\n"
            "- Take a 15-minute walk at a comfortable pace.\n"
            "- Check and log your blood pressure.\n"
            "- Practice 5 minutes of deep breathing exercises.\n"
            "- Eat at least 2 servings of fruits or vegetables with each meal."
        )

    return {
        "tips": tips_text,
        "risk_level": risk_level,
        "generated_at": time.time(),
    }
