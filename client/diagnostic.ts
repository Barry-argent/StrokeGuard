import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB DIAGNOSTIC ---');
  try {
    const session = await prisma.monitoringSession.findFirst();
    if (session) {
      console.log('Sample Session:', {
        id: session.id,
        alertFailure: session.alertFailure,
        type: typeof session.alertFailure
      });
    } else {
      console.log('No sessions found.');
    }
  } catch (err: any) {
    console.error('Diagnostic failed:', err.message);
    if (err.code === 'P2023') {
        console.error('Confirmed: Type mismatch persists in DB read.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
