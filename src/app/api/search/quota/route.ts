import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    searches_used: 0,
    search_limit: 20,
    remaining: 20,
    is_unlimited: false,
    plan: 'free',
    priority_booking: false,
  });
}
