import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';
import { incrementSearchUsage, FREE_SEARCH_LIMIT } from '@/lib/quotaStore';

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

function resolveCategory(query: string): string | null {
  if (!query) return null;
  const q = query.toLowerCase();
  if (/(анализ|лаборатор|lab|blood|тест|оак|оам|қан|талдау|биохими|пцр|гормон|ферритин|витамин|oak)/i.test(q)) {
    return 'laboratory';
  }
  if (/(прием|приём|врач|doctor|дәрігер|қабылдау|терапевт|педиатр|кардиолог|невропатолог|гинеколог|уролог|лор)/i.test(q)) {
    return 'doctor_appointment';
  }
  if (/(узи|мрт|рентген|кт|диагностика|scanner|экг|эхокг|удз|mrt|mpt|mri|uzi|ct|xray)/i.test(q)) {
    return 'diagnostics';
  }
  if (/(процедура|укол|капельница|массаж|фгдс|инъекци)/i.test(q)) {
    return 'procedure';
  }
  return null;
}

function normalizeSearchToken(token: string): string[] {
  const t = token.toLowerCase();
  const variants = new Set<string>([t]);

  const synonyms: Record<string, string[]> = {
    mpt: ['мрт', 'томограф', 'магнитно-резонансная', 'mri'],
    mrt: ['мрт', 'томограф', 'магнитно-резонансная', 'mri'],
    mri: ['мрт', 'томограф', 'магнитно-резонансная'],
    мрт: ['мрт', 'томограф', 'магнитно-резонансная', 'mrt', 'mpt', 'mri'],
    uzi: ['узи', 'удз', 'ультразвук'],
    узи: ['узи', 'удз', 'ультразвук', 'uzi'],
    удз: ['узи', 'удз', 'ультразвук', 'uzi'],
    oak: ['оак', 'общий анализ крови', 'қан'],
    оак: ['оак', 'общий анализ крови', 'қан', 'oak'],
    kt: ['кт', 'компьютерная томография', 'ct'],
    кт: ['кт', 'компьютерная томография', 'kt'],
  };

  if (synonyms[t]) {
    synonyms[t].forEach((s) => variants.add(s));
  }

  // Map visual homoglyphs (e.g. latin 'm' -> cyrillic 'м', 'p' -> 'р', 't' -> 'т')
  const homoglyphs: Record<string, string> = {
    a: 'а', b: 'в', e: 'е', k: 'к', m: 'м', h: 'н', o: 'о', p: 'р', c: 'с', t: 'т', x: 'х', y: 'у'
  };
  let cyrillicAttempt = '';
  let hadHomoglyph = false;
  for (const ch of t) {
    if (homoglyphs[ch]) {
      cyrillicAttempt += homoglyphs[ch];
      hadHomoglyph = true;
    } else {
      cyrillicAttempt += ch;
    }
  }
  if (hadHomoglyph) {
    variants.add(cyrillicAttempt);
  }

  return Array.from(variants);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const rawCity = searchParams.get('city');
  const city = normalizeCity(rawCity);
  const minRating = searchParams.get('min_rating') ? parseFloat(searchParams.get('min_rating')!) : null;
  const onlineBooking = searchParams.get('online_booking') === 'true';
  const hasPromotion = searchParams.get('has_promotion') === 'true';
  const minPrice = searchParams.get('min_price') ? parseFloat(searchParams.get('min_price')!) : null;
  const maxPrice = searchParams.get('max_price') ? parseFloat(searchParams.get('max_price')!) : null;
  const sortBy = searchParams.get('sort_by') || '';
  const specialty = (searchParams.get('specialty') || '').toLowerCase().trim();

  const sessionId = req.headers.get('x-search-session') || req.headers.get('x-forwarded-for') || 'guest_default';
  const quotaResult = incrementSearchUsage(sessionId);

  if (quotaResult.blocked) {
    return NextResponse.json(
      {
        detail: {
          code: 'SEARCH_LIMIT_REACHED',
          message: 'Тегін іздеу лимиті (20/20) таусылды. Шексіз іздеу үшін тарифті таңдаңыз.',
          limit_reached: true,
          searches_used: quotaResult.used,
          limit: FREE_SEARCH_LIMIT,
        },
      },
      { status: 402 }
    );
  }

  const clinicsMap = new Map<string, any>(mockData.clinics.map((c: any) => [c.id, c]));
  const servicesMap = new Map<string, any>(mockData.services.map((s: any) => [s.id, s]));

  const queryCategory = resolveCategory(q);
  const qTokens = q.toLowerCase().split(/\s+/).filter(Boolean);

  // Group prices by service_id
  const serviceOffersMap = new Map<string, { service: any; offers: any[] }>();

  for (const priceObj of mockData.prices as any[]) {
    const clinic = clinicsMap.get(priceObj.clinic_id);
    const service = servicesMap.get(priceObj.service_id);
    if (!clinic || !service) continue;

    // Filter by city
    if (city && city !== 'Барлық қалалар' && city !== 'Все города') {
      const clinicCity = (clinic.city || '').toLowerCase();
      const targetCity = city.toLowerCase();
      if (!clinicCity.includes(targetCity) && !targetCity.includes(clinicCity)) {
        continue;
      }
    }

    // Filter by clinic attributes
    if (minRating !== null && (clinic.rating || 0) < minRating) continue;
    if (onlineBooking && !clinic.has_online_booking) continue;
    if (hasPromotion && !clinic.has_active_promotion && !priceObj.is_promotional) continue;

    // Filter by price
    const priceVal = parseFloat(priceObj.price_kzt || priceObj.price || 0);
    if (minPrice !== null && priceVal < minPrice) continue;
    if (maxPrice !== null && priceVal > maxPrice) continue;

    // Filter by specialty if provided
    if (specialty) {
      const sRaw = (service.name_raw || '').toLowerCase();
      if (!sRaw.includes(specialty)) continue;
    }

    // Filter by query / category
    if (qTokens.length > 0) {
      const sNorm = (service.name_norm || '').toLowerCase();
      const sRaw = (service.name_raw || '').toLowerCase();
      const cName = (clinic.name || '').toLowerCase();
      const sCat = (service.category || '').toLowerCase();

      const allTokens = qTokens.flatMap((token) => normalizeSearchToken(token));
      const matchesCat = queryCategory && sCat === queryCategory;
      const matchesText = allTokens.some(
        (token) => sNorm.includes(token) || sRaw.includes(token) || cName.includes(token)
      );

      if (!matchesCat && !matchesText) continue;
    }

    if (!serviceOffersMap.has(service.id)) {
      serviceOffersMap.set(service.id, { service, offers: [] });
    }

    serviceOffersMap.get(service.id)!.offers.push({
      clinic,
      price: priceVal,
      parsed_at: priceObj.parsed_at,
    });
  }

  // Construct SearchResult items
  const results = Array.from(serviceOffersMap.values()).map(({ service, offers }) => {
    offers.sort((a, b) => a.price - b.price);
    const bestOffer = offers[0];
    const avgPrice = Math.round(offers.reduce((sum, item) => sum + item.price, 0) / offers.length);

    return {
      service: {
        id: service.id,
        name_raw: service.name_raw,
        category: service.category,
      },
      avg_price: avgPrice,
      min_price: bestOffer.price,
      clinics_count: offers.length,
      best_offer_clinic: {
        id: bestOffer.clinic.id,
        name: bestOffer.clinic.name,
        city: bestOffer.clinic.city,
        address: bestOffer.clinic.address,
        rating: bestOffer.clinic.rating,
        has_online_booking: Boolean(bestOffer.clinic.has_online_booking),
        has_active_promotion: Boolean(bestOffer.clinic.has_active_promotion),
        latitude: bestOffer.clinic.latitude,
        longitude: bestOffer.clinic.longitude,
        source_url: bestOffer.clinic.source_url,
      },
      best_offer_price: bestOffer.price,
      last_updated_at: bestOffer.parsed_at || new Date().toISOString(),
    };
  });

  // Sort results
  if (sortBy === 'price_asc') {
    results.sort((a, b) => a.min_price - b.min_price);
  } else if (sortBy === 'price_desc') {
    results.sort((a, b) => b.min_price - a.min_price);
  } else if (sortBy === 'rating_desc') {
    results.sort((a, b) => (b.best_offer_clinic?.rating || 0) - (a.best_offer_clinic?.rating || 0));
  } else if (sortBy === 'date_desc') {
    results.sort((a, b) => (b.last_updated_at || '').localeCompare(a.last_updated_at || ''));
  }

  const response = NextResponse.json(results);
  response.headers.set('X-Search-Remaining', String(quotaResult.remaining));
  response.headers.set('X-Search-Limit', String(quotaResult.limit));
  response.headers.set('X-Search-Unlimited', quotaResult.plan !== 'free' ? 'true' : 'false');
  response.headers.set('X-Search-Plan', quotaResult.plan);
  return response;
}
