import os
import json
import logging
import sqlite3
import statistics
import time
from typing import Optional, List

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, field_validator
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from google import genai
from google.genai import types
from twilio.rest import Client

# --- INITIALIZATION ---
load_dotenv()
client = genai.Client()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="StrokeGuard API Gateway", version="2.1.0")

# FIX: allow_origins=["*"] is incompatible with allow_credentials=True per the CORS spec.
# Using explicit origins list. Set ALLOWED_ORIGINS in your .env for production.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- DATABASE ENGINE ---
def init_db():
    with sqlite3.connect("strokeguard.db") as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, state TEXT)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, profile_data TEXT)"
        )


init_db()


def get_db_row(table: str, entry_id: str) -> dict:
    col = "state" if table == "patients" else "profile_data"
    # NOTE: `col` and `table` are derived from internal constants only, not user input,
    # so f-string interpolation here is safe from SQL injection.
    with sqlite3.connect("strokeguard.db") as conn:
        cursor = conn.execute(
            f"SELECT {col} FROM {table} WHERE id=?", (str(entry_id),)
        )
        row = cursor.fetchone()
        return json.loads(row[0]) if row else {}


def save_db_row(table: str, entry_id: str, data: dict):
    col = "state" if table == "patients" else "profile_data"
    with sqlite3.connect("strokeguard.db") as conn:
        conn.execute(
            f"INSERT OR REPLACE INTO {table} (id, {col}) VALUES (?, ?)",
            (str(entry_id), json.dumps(data)),
        )


def log_alert_failure(patient_id: str, reason: str):
    """Persist SMS/alert failures to DB so the frontend can surface a warning."""
    state = get_db_row("patients", patient_id)
    state["alert_failure"] = reason
    save_db_row("patients", patient_id, state)


# Minimum BPM readings required for a statistically meaningful SDNN calculation.
# Clinically, 5 minutes (~300+ readings) is the gold standard, but for mobile
# quick scans 30 readings captures several breathing cycles and is a practical floor.
# Requests with fewer readings are rejected with a 422 rather than falling back silently.
MIN_BPM_READINGS = 30

# --- DATA MODELS ---
class ProfilePayload(BaseModel):
    patient_id: str
    name: str
    age: int
    history: str
    recent_activity: str
    # FIX: Emergency contact is now per-patient, not hardcoded in the codebase.
    emergency_contact: str  # E.164 format, e.g. "+2347069547832"

    @field_validator("emergency_contact")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.startswith("+") or not v[1:].isdigit():
            raise ValueError("emergency_contact must be in E.164 format, e.g. +2347069547832")
        return v


class VitalsPayload(BaseModel):
    patient_id: str
    mode: Optional[str] = "PASSIVE"  # PASSIVE, QUICK_SCAN, DEEP_SCAN
    pulse_rate_history: List[float]  # BPM values from React
    prv_score: float                 # Calculated SDNN from React (cross-check + fallback)
    aha_lifestyle_score: int
    is_exercising: bool
    final_risk_score: Optional[float] = None
    systolic: Optional[int] = 120
    diastolic: Optional[int] = 80
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("pulse_rate_history")
    @classmethod
    def validate_bpm_history(cls, v: List[float]) -> List[float]:
        if len(v) < MIN_BPM_READINGS:
            raise ValueError(
                f"pulse_rate_history must contain at least {MIN_BPM_READINGS} BPM readings "
                f"for a meaningful SDNN calculation. Got {len(v)}."
            )
        return v
