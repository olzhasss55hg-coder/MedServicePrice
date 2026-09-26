import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `bk_${Math.random().toString(36).substring(2, 10)}`;
    return NextResponse.json(
      {
        id,
        status: 'confirmed',
        message: 'Запись успешно оформлена',
        ...body,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Booking creation failed' }, { status: 400 });
  }
}
