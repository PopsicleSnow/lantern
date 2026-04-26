import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.journalist_id) {
    const recipient = tip.ciphertexts.find((c) => c.journalist_id === body.journalist_id);
    if (!recipient) {
      return NextResponse.json(
        {
          error:
            'Cannot reassign: target journalist is not in the encrypted recipient set for this tip',
        },
        { status: 400 }
      );
    }
    tip.assigned_journalist_id = body.journalist_id;
    tip.status = 'routed';
  } else if (body.status === 'closed') {
    tip.status = 'closed';
  } else {
    return NextResponse.json(
      { error: 'Provide journalist_id or status: closed' },
      { status: 400 }
    );
  }

  tip.updated_at = new Date();
  await tip.save();

  return NextResponse.json({
    tip_id: id,
    status: tip.status,
    assigned_journalist_id: tip.assigned_journalist_id ?? null,
  });
}
