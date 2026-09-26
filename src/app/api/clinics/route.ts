import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const query = searchParams.get('query') || searchParams.get('q');

  let clinics = [...mockData.clinics];

  if (city && city.toLowerCase() !== 'барлық қалалар' && city.toLowerCase() !== 'все города') {
    clinics = clinics.filter((c: any) =>
      (c.city || '').toLowerCase().includes(city.toLowerCase()) ||
      city.toLowerCase().includes((c.city || '').toLowerCase())
    );
  }

  if (query) {
    const qLower = query.toLowerCase();
    clinics = clinics.filter((c: any) =>
      (c.name || '').toLowerCase().includes(qLower) ||
      (c.address || '').toLowerCase().includes(qLower)
    );
  }

  return NextResponse.json(clinics);
}
