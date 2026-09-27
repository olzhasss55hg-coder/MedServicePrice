import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = mockData.services.find((s: any) => s.id === id);

  if (!service) {
    return NextResponse.json({ detail: 'Service not found' }, { status: 404 });
  }

  return NextResponse.json(service);
}
