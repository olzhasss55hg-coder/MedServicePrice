import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();
    return NextResponse.json({
      status: 'success',
      message: 'Тариф сәтті қосылды!',
      plan,
      is_unlimited_search: true,
      priority_booking: plan === 'premium' || plan === 'vip',
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Payment error' }, { status: 400 });
  }
}
