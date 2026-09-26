import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = mockData.clinics.find((c: any) => c.id === id);

  if (!clinic) {
    return NextResponse.json({ detail: 'Clinic not found' }, { status: 404 });
  }

  const doctors = mockData.doctors.filter((d: any) => d.clinic_id === id);
  const clinicPrices = mockData.prices.filter((p: any) => p.clinic_id === id);
  const servicesMap = new Map<string, any>(mockData.services.map((s: any) => [s.id, s]));

  const pricesWithService = clinicPrices.map((p: any) => {
    const s = servicesMap.get(p.service_id) || {};
    return {
      id: p.id,
      service_id: p.service_id,
      service_name: s.name || 'Медицинская услуга',
      category: s.category || 'general',
      price: p.price,
      old_price: p.old_price,
      is_promotional: p.is_promotional,
    };
  });

  return NextResponse.json({
    ...clinic,
    doctors,
    prices: pricesWithService,
    services: pricesWithService,
  });
}
