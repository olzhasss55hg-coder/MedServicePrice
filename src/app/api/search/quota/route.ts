import { NextRequest, NextResponse } from 'next/server';
import { getSessionData, FREE_SEARCH_LIMIT } from '@/lib/quotaStore';

export async function GET(req: NextRequest) {
  const sessionId = req.headers.get('x-search-session') || req.headers.get('x-forwarded-for') || 'guest_default';
  const session = getSessionData(sessionId);

  const isUnlimited = session.plan !== 'free';
  const remaining = isUnlimited ? null : Math.max(0, FREE_SEARCH_LIMIT - session.used);

  return NextResponse.json({
    searches_used: session.used,
    search_limit: isUnlimited ? null : FREE_SEARCH_LIMIT,
    remaining,
    is_unlimited: isUnlimited,
    plan: session.plan,
    priority_booking: session.plan === 'premium' || session.plan === 'vip',
  });
}
