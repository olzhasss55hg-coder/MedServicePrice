import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const defaultSlots = [
    { time: '09:00', is_available: true },
    { time: '10:00', is_available: true },
    { time: '11:00', is_available: true },
    { time: '14:00', is_available: true },
    { time: '15:00', is_available: true },
    { time: '16:00', is_available: true },
    { time: '17:00', is_available: true },
  ];
  return NextResponse.json(defaultSlots);
}
