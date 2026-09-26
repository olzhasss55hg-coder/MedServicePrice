import { NextRequest, NextResponse } from 'next/server';
import { upgradeSessionPlan } from '@/lib/quotaStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = (body.plan || 'standard').toLowerCase();
    const sessionId = req.headers.get('x-search-session') || req.headers.get('x-forwarded-for') || 'guest_default';

    const normalizedPlan = (plan === 'vip' || plan === 'premium') ? 'premium' : (plan === 'standard' ? 'standard' : 'free');
    upgradeSessionPlan(sessionId, normalizedPlan);

    return NextResponse.json({
      status: 'success',
      message: `Тариф сәтті іске қосылды: ${normalizedPlan.toUpperCase()}`,
      plan: normalizedPlan,
      is_unlimited_search: normalizedPlan !== 'free',
      priority_booking: normalizedPlan === 'premium',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Payment processing error' },
      { status: 500 }
    );
  }
}
