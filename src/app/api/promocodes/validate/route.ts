import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function POST(req: NextRequest) {
  try {
    const { code, amount } = await req.json();
    const cleanCode = (code || '').trim().toUpperCase();

    const promo = mockData.promo_codes.find((p: any) => p.code.toUpperCase() === cleanCode && p.is_active);

    if (!promo) {
      return NextResponse.json({ detail: 'Жарамсыз немесе мерзімі өткен промокод' }, { status: 400 });
    }

    let discountAmount = 0;
    if (promo.discount_type === 'percent') {
      discountAmount = Math.round(amount * (promo.discount_value / 100));
    } else {
      discountAmount = Math.min(amount, promo.discount_value);
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_amount: discountAmount,
      total_amount: Math.max(0, amount - discountAmount),
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Error validating promo code' }, { status: 400 });
  }
}
