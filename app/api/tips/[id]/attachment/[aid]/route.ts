import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/lib/models/Attachment';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const journalist_id = req.nextUrl.searchParams.get('journalist_id');
  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  const { id, aid } = await params;

  await dbConnect();
  const attachment = await Attachment.findOne({ _id: aid, tip_id: id });
  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const wrapped = attachment.wrapped_keys.find((w) => w.journalist_id === journalist_id);
  if (!wrapped) {
    return NextResponse.json({ error: 'Forbidden: not a recipient' }, { status: 403 });
  }

  const buf = Buffer.isBuffer(attachment.file_ciphertext)
    ? attachment.file_ciphertext
    : Buffer.from(attachment.file_ciphertext as unknown as ArrayBuffer);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  });
}
