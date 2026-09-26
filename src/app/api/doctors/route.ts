import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get('clinic_id');
  const specialty = searchParams.get('specialty');

  let docs = [...mockData.doctors];

  if (clinicId) {
    docs = docs.filter((d: any) => d.clinic_id === clinicId);
  }

  if (specialty) {
    const sLower = specialty.toLowerCase();
    docs = docs.filter((d: any) => (d.specialty || '').toLowerCase().includes(sLower));
  }

  return NextResponse.json(docs);
}
