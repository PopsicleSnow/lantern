// POST /api/tips/[id]/close
// Auth: Authorization: Bearer demo-token
// Body: { journalist_id }
//
// A journalist who is a recipient of the tip marks it closed (investigation
// complete). This unlocks bounty claims on /status for the original tipper.

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
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid tip id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { journalist_id?: string };
  if (!body.journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isRecipient = tip.ciphertexts.some((c) => c.journalist_id === body.journalist_id);
  if (!isRecipient) {
    return NextResponse.json({ error: 'Forbidden: not a recipient' }, { status: 403 });
  }

  if (tip.status === 'closed') {
    return NextResponse.json({
      tip_id: id,
      status: 'closed',
      closed_at: tip.updated_at,
      already_closed: true,
    });
  }

  tip.status = 'closed';
  tip.updated_at = new Date();
  await tip.save();

  return NextResponse.json({
    tip_id: id,
    status: 'closed',
    closed_at: tip.updated_at,
  });
}
