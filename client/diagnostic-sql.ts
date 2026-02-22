import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- RAW SQL DIAGNOSTIC ---');
  try {
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'MonitoringSession';
    `;
    console.log('Columns in MonitoringSession:', JSON.stringify(tableInfo, null, 2));
    
    const sampleVal = await prisma.$queryRaw`
      SELECT "alertFailure" FROM "MonitoringSession" LIMIT 1;
    `;
    console.log('Sample raw value:', JSON.stringify(sampleVal, null, 2));

  } catch (err: any) {
    console.error('SQL Diagnostic failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
