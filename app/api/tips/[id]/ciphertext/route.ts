import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Tip, { type ICiphertextEntry } from '@/lib/models/Tip';
import Journalist from '@/lib/models/Journalist';

function isValidCiphertext(c: unknown): c is ICiphertextEntry {
  if (!c || typeof c !== 'object') return false;
  const ct = c as Record<string, unknown>;
  return (
    typeof ct.journalist_id === 'string' &&
    typeof ct.ciphertext === 'string' &&
    typeof ct.nonce === 'string' &&
    typeof ct.ephemeral_pubkey === 'string'
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { ciphertexts } = body;

  if (!Array.isArray(ciphertexts) || ciphertexts.length === 0) {
    return NextResponse.json({ error: 'ciphertexts array required' }, { status: 400 });
  }
  if (!ciphertexts.every(isValidCiphertext)) {
    return NextResponse.json({ error: 'Invalid ciphertext entry' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (tip.status !== 'awaiting_ciphertext') {
    return NextResponse.json(
      { error: 'Tip is not awaiting ciphertext' },
      { status: 409 }
    );
  }

  const submitted_ids = new Set(ciphertexts.map((c) => c.journalist_id));
  const has_assigned =
    !tip.assigned_journalist_id || submitted_ids.has(tip.assigned_journalist_id);

  tip.ciphertexts = ciphertexts;
  tip.status = has_assigned && tip.assigned_journalist_id ? 'routed' : 'human_review';
  if (!has_assigned) tip.assigned_journalist_id = undefined;
  tip.updated_at = new Date();
  await tip.save();

  if (tip.status === 'routed' && tip.assigned_journalist_id) {
    if (mongoose.isValidObjectId(tip.assigned_journalist_id)) {
      await Journalist.updateOne(
        { _id: new mongoose.Types.ObjectId(tip.assigned_journalist_id) },
        { $inc: { tip_count: 1 } }
      );
    }
  }

  return NextResponse.json({
    tip_id: id,
    status: tip.status,
  });
}
