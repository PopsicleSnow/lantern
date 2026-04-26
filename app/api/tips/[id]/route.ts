import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const journalist_id = req.nextUrl.searchParams.get('journalist_id');
  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id).lean<{
    _id: unknown;
    metadata: Record<string, unknown>;
    ciphertexts: Array<{
      journalist_id: string;
      ciphertext: string;
      nonce: string;
      ephemeral_pubkey: string;
    }>;
    verified_human: boolean;
    priority: string;
    status: string;
    category: string;
    category_confidence: number;
    classification_source: string;
    beats_matched: string[];
    urgency: string;
    assigned_journalist_id?: string;
    read_at?: Date;
    credibility_at_submission?: number;
    created_at: Date;
  }>();

  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ciphertext = tip.ciphertexts.find((c) => c.journalist_id === journalist_id);
  if (!ciphertext) {
    return NextResponse.json({ error: 'Forbidden: not a recipient' }, { status: 403 });
  }

  return NextResponse.json({
    _id: String(tip._id),
    metadata: tip.metadata,
    ciphertext,
    verified_human: tip.verified_human,
    priority: tip.priority,
    status: tip.status,
    category: tip.category,
    category_confidence: tip.category_confidence,
    classification_source: tip.classification_source,
    beats_matched: tip.beats_matched,
    urgency: tip.urgency,
    assigned_journalist_id: tip.assigned_journalist_id ?? null,
    read_at: tip.read_at ?? null,
    credibility_at_submission: tip.credibility_at_submission ?? null,
    created_at: tip.created_at,
  });
}
