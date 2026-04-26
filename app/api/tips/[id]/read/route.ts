import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const journalist_id = body.journalist_id as string | undefined;
  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const recipient = tip.ciphertexts.find((c) => c.journalist_id === journalist_id);
  if (!recipient) {
    return NextResponse.json({ error: 'Forbidden: not a recipient' }, { status: 403 });
  }

  if (!tip.read_at) {
    tip.read_at = new Date();
    tip.read_by_journalist_id = journalist_id;
    tip.updated_at = new Date();
    await tip.save();
  }

  return NextResponse.json({ tip_id: id, read_at: tip.read_at });
}
