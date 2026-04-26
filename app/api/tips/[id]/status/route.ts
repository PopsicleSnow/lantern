import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid tip id' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id, {
    status: 1,
    created_at: 1,
    read_at: 1,
    priority: 1,
    category: 1,
  }).lean<{
    status: string;
    created_at: Date;
    read_at?: Date;
    priority: string;
    category: string;
  }>();

  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    status: tip.status,
    created_at: tip.created_at,
    read: !!tip.read_at,
    read_at: tip.read_at ?? null,
    priority: tip.priority,
    category: tip.category,
  });
}
