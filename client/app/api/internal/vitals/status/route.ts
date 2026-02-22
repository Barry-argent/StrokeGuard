import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://strokeguard-endo.onrender.com';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendRes = await fetch(`${EXTERNAL_API_URL}/api/v1/patient/${session.user.id}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!backendRes.ok) {
        const errorText = await backendRes.text();
        console.error(`[Vitals Status] External Backend Error (${backendRes.status}):`, errorText);
        if(backendRes.status === 404) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Backend error', details: errorText }, { status: backendRes.status });
    }

    const data = await backendRes.json();
    console.log(">>> PYTHON STATUS RESPONSE:", data);
    
    const triageStatus = data.status || 'GREEN'; // Python API returns "status"
    
    // Prioritize the actual risk score if available, otherwise fallback to status-based score
    // Note: 100 = Perfect Health. So GREEN should be high (~85), RED should be low (~20).
    const computedScore = data.risk_score ?? (triageStatus === 'RED' ? 20 : triageStatus === 'YELLOW' ? 50 : 85);

    console.log(">>> MAPPED UI STATE:", { triageStatus, score: computedScore });
    
    return NextResponse.json({
        triage_status: triageStatus,
        risk_score: computedScore,
        ai_advice: data.ai_advice || data.ai_coach || null,
        alert_failure: data.alert_failure || null,
        ui_action: data.ui_action || 'PASSIVE_MONITORING',
    });

  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
