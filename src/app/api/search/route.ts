import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

const searchUsageMap = new Map<string, number>();
const FREE_LIMIT = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const city = (searchParams.get('city') || '').trim();
  const category = (searchParams.get('category') || '').trim();
  const minPrice = parseFloat(searchParams.get('min_price') || '0');
  const maxPrice = parseFloat(searchParams.get('max_price') || '999999999');
  const sortBy = searchParams.get('sort_by') || 'relevance';
  const onlyPromos = searchParams.get('only_promos') === 'true';

  const sessionId = req.headers.get('x-search-session') || req.headers.get('x-forwarded-for') || 'guest_default';
  const currentUsage = searchUsageMap.get(sessionId) || 0;

  if (currentUsage >= FREE_LIMIT) {
    return NextResponse.json(
      {
        detail: {
          code: 'SEARCH_LIMIT_REACHED',
          message: 'Тегін іздеу лимиті (20/20) таусылды. Шексіз іздеу үшін тарифті таңдаңыз.',
          limit_reached: true,
          searches_used: currentUsage,
          limit: FREE_LIMIT,
        },
      },
      { status: 402 }
    );
  }

  // Increment usage
  const newUsage = currentUsage + 1;
  searchUsageMap.set(sessionId, newUsage);
  const remaining = Math.max(0, FREE_LIMIT - newUsage);

  // Group prices by service
  const clinicsMap = new Map<string, any>(mockData.clinics.map((c: any) => [c.id, c]));
  const serviceOffersMap = new Map<string, { service: any; offers: any[] }>();

  for (const p of mockData.prices as any[]) {
    const clinic = clinicsMap.get(p.clinic_id);
    if (!clinic) continue;

    if (city && city.toLowerCase() !== 'барлық қалалар' && city.toLowerCase() !== 'все города') {
      const cCity = (clinic.city || '').toLowerCase();
      const sCity = city.toLowerCase();
      if (!cCity.includes(sCity) && !sCity.includes(cCity)) continue;
    }

    const priceVal = parseFloat(p.price || 0);
    if (priceVal < minPrice || priceVal > maxPrice) continue;
    if (onlyPromos && !clinic.has_active_promotion && !p.is_promotional) continue;

    const s = mockData.services.find((serv: any) => serv.id === p.service_id);
    if (!s) continue;

    if (category && s.category !== category) continue;

    if (q) {
      const qTokens = q.split(/\s+/).filter(Boolean);
      const matchName = qTokens.some((t: string) => (s.name || '').toLowerCase().includes(t));
      const matchCat = qTokens.some((t: string) => (s.category || '').toLowerCase().includes(t));
      const matchClinic = qTokens.some((t: string) => (clinic.name || '').toLowerCase().includes(t));
      const matchSpec = qTokens.some((t: string) => (s.specialty || '').toLowerCase().includes(t));
      if (!matchName && !matchCat && !matchClinic && !matchSpec) continue;
    }

    if (!serviceOffersMap.has(s.id)) {
      serviceOffersMap.set(s.id, { service: s, offers: [] });
    }

    serviceOffersMap.get(s.id)!.offers.push({
      clinic_id: clinic.id,
      clinic_name: clinic.name,
      clinic_address: clinic.address,
      clinic_city: clinic.city,
      rating: clinic.rating,
      reviews_count: clinic.reviews_count,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      price: priceVal,
      old_price: p.old_price,
      is_promotional: p.is_promotional || clinic.has_active_promotion,
      has_online_booking: clinic.has_online_booking,
      phone: clinic.phone,
      source_url: clinic.source_url,
      photo_url: clinic.photo_url,
    });
  }

  const results = Array.from(serviceOffersMap.values()).map(({ service, offers }) => {
    offers.sort((a, b) => a.price - b.price);
    const minOffer = offers[0];
    const maxOffer = offers[offers.length - 1];
    const avgPrice = Math.round(offers.reduce((acc, curr) => acc + curr.price, 0) / offers.length);

    return {
      service_id: service.id,
      service_name: service.name,
      category: service.category,
      min_price: minOffer.price,
      max_price: maxOffer.price,
      avg_price: avgPrice,
      total_clinics: offers.length,
      best_offer: minOffer,
      clinics: offers,
    };
  });

  if (sortBy === 'price_asc') {
    results.sort((a, b) => a.min_price - b.min_price);
  } else if (sortBy === 'price_desc') {
    results.sort((a, b) => b.min_price - a.min_price);
  } else if (sortBy === 'rating') {
    results.sort((a, b) => (b.best_offer?.rating || 0) - (a.best_offer?.rating || 0));
  }

  const response = NextResponse.json(results);
  response.headers.set('X-Search-Remaining', String(remaining));
  response.headers.set('X-Search-Limit', String(FREE_LIMIT));
  response.headers.set('X-Search-Unlimited', 'false');
  response.headers.set('X-Search-Plan', 'free');
  return response;
}
