import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

const CITY_ALIASES: Record<string, string> = {
  astana: 'Астана',
  астана: 'Астана',
  'nur-sultan': 'Астана',
  'нур-султан': 'Астана',
  almaty: 'Алматы',
  алматы: 'Алматы',
  алмата: 'Алматы',
  shymkent: 'Шымкент',
  шымкент: 'Шымкент',
  чимкент: 'Шымкент',
  karaganda: 'Қарағанды',
  караганда: 'Қарағанды',
  қарағанды: 'Қарағанды',
  aktobe: 'Ақтөбе',
  актобе: 'Ақтөбе',
  ақтөбе: 'Ақтөбе',
  pavlodar: 'Павлодар',
  павлодар: 'Павлодар',
};

function normalizeCity(rawCity: string | null): string | null {
  if (!rawCity) return null;
  const cleaned = rawCity.toLowerCase().replace(/^(г\.|г\s+|город\s+|қ\.|қ\s+|қаласы)/i, '').trim();
  return CITY_ALIASES[cleaned] || rawCity;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const rawCity = searchParams.get('city');
  const targetCity = normalizeCity(rawCity);

  const service = mockData.services.find((s: any) => s.id === id);
  if (!service) {
    return NextResponse.json({ detail: 'Service not found' }, { status: 404 });
  }

  const clinicsMap = new Map<string, any>(mockData.clinics.map((c: any) => [c.id, c]));
  const allServicePrices = mockData.prices.filter((p: any) => p.service_id === id);

  let filteredPrices = allServicePrices;
  if (targetCity && targetCity !== 'Барлық қалалар' && targetCity !== 'Все города') {
    const tLower = targetCity.toLowerCase();
    const cityMatched = allServicePrices.filter((p: any) => {
      const clinic = clinicsMap.get(p.clinic_id);
      if (!clinic) return false;
      const cCity = (clinic.city || '').toLowerCase();
      return cCity.includes(tLower) || tLower.includes(cCity);
    });

    // If matches found for city, use them; otherwise keep all to avoid empty state
    if (cityMatched.length > 0) {
      filteredPrices = cityMatched;
    }
  }

  const result = filteredPrices.map((p: any) => {
    const clinic = clinicsMap.get(p.clinic_id) || {};
    return {
      id: p.id,
      clinic_id: p.clinic_id,
      service_id: p.service_id,
      price_kzt: parseFloat(p.price_kzt || p.price || 0),
      parsed_at: p.parsed_at || new Date().toISOString(),
      clinic: {
        id: clinic.id,
        name: clinic.name,
        city: clinic.city,
        address: clinic.address,
        phone: clinic.phone,
        working_hours: clinic.working_hours,
        source_url: clinic.source_url,
        photo_url: clinic.photo_url,
        district: clinic.district,
        latitude: clinic.latitude,
        longitude: clinic.longitude,
        rating: clinic.rating || 4.5,
        reviews_count: clinic.reviews_count || 10,
        has_online_booking: Boolean(clinic.has_online_booking),
        has_active_promotion: Boolean(clinic.has_active_promotion),
      },
      service: {
        id: service.id,
        name_raw: service.name_raw,
        name_norm: service.name_norm || service.name_raw,
        category: service.category,
      },
    };
  });

  return NextResponse.json(result);
}
