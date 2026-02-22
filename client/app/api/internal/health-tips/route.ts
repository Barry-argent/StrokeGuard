import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://strokeguard-endo.onrender.com';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendRes = await fetch(
      `${EXTERNAL_API_URL}/api/v1/patient/${session.user.id}/health-tips`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      console.error(`[Health Tips] External Backend Error (${backendRes.status}):`, errorText);
      return NextResponse.json({ error: 'Backend error', details: errorText }, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Health Tips] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
