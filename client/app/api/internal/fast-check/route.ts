import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mode, faceResult, armResult, speechResult, overallOutcome } = await req.json();

    if (!faceResult || !armResult || !speechResult || !overallOutcome) {
      return NextResponse.json({ error: 'Missing required results' }, { status: 400 });
    }

    const newResult = await prisma.fastScanResult.create({
      data: {
        userId: session.user.id,
        mode: mode || 'self',
        faceResult,
        armResult,
        speechResult,
        overallOutcome,
      },
    });

    return NextResponse.json({ success: true, id: newResult.id });
  } catch (error) {
    console.error('[FAST_CHECK_SYNC_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
