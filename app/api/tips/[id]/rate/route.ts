import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';
import { recordRating, type Rating } from '@/lib/credibility';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const journalist_id = body.journalist_id as string | undefined;
  const rating = body.rating as Rating | undefined;

  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }
  if (rating !== 'valuable' && rating !== 'dismissed') {
    return NextResponse.json({ error: 'rating must be valuable or dismissed' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const recipient = tip.ciphertexts.find((c) => c.journalist_id === journalist_id);
  if (!recipient) {
    return NextResponse.json({ error: 'Forbidden: not a recipient' }, { status: 403 });
  }

  const new_score = await recordRating(tip.nullifier_hash, rating);

  return NextResponse.json({
    tip_id: id,
    rating,
    nullifier_score: new_score,
  });
}
