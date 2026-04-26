import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';
import Attachment, { type IWrappedKey } from '@/lib/models/Attachment';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_TIP = 5;

interface UploadMeta {
  file_nonce: string;
  filename_ciphertext: string;
  filename_nonce: string;
  mime_type?: string;
  file_size: number;
  wrapped_keys: IWrappedKey[];
}

function isValidWrappedKey(k: unknown): k is IWrappedKey {
  if (!k || typeof k !== 'object') return false;
  const w = k as Record<string, unknown>;
  return (
    typeof w.journalist_id === 'string' &&
    typeof w.key_ciphertext === 'string' &&
    typeof w.key_nonce === 'string' &&
    typeof w.ephemeral_pubkey === 'string'
  );
}

function isValidMeta(m: unknown): m is UploadMeta {
  if (!m || typeof m !== 'object') return false;
  const meta = m as Record<string, unknown>;
  return (
    typeof meta.file_nonce === 'string' &&
    typeof meta.filename_ciphertext === 'string' &&
    typeof meta.filename_nonce === 'string' &&
    typeof meta.file_size === 'number' &&
    Array.isArray(meta.wrapped_keys) &&
    meta.wrapped_keys.length > 0 &&
    meta.wrapped_keys.every(isValidWrappedKey)
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }

  const file = form.get('file');
  const metaRaw = form.get('meta');
  if (!(file instanceof Blob) || typeof metaRaw !== 'string') {
    return NextResponse.json({ error: 'file and meta fields required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'file is empty' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file exceeds 10MB' }, { status: 413 });
  }

  let meta: UploadMeta;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return NextResponse.json({ error: 'meta is not valid JSON' }, { status: 400 });
  }
  if (!isValidMeta(meta)) {
    return NextResponse.json({ error: 'invalid meta' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (tip.status !== 'awaiting_ciphertext') {
    return NextResponse.json(
      { error: 'Tip no longer accepting attachments' },
      { status: 409 }
    );
  }

  const existing = await Attachment.countDocuments({ tip_id: id });
  if (existing >= MAX_ATTACHMENTS_PER_TIP) {
    return NextResponse.json(
      { error: `Max ${MAX_ATTACHMENTS_PER_TIP} attachments per tip` },
      { status: 409 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const doc = await Attachment.create({
    tip_id: id,
    file_ciphertext: buf,
    file_nonce: meta.file_nonce,
    filename_ciphertext: meta.filename_ciphertext,
    filename_nonce: meta.filename_nonce,
    mime_type: meta.mime_type ?? 'application/octet-stream',
    file_size: meta.file_size,
    wrapped_keys: meta.wrapped_keys,
  });

  return NextResponse.json(
    { attachment_id: String(doc._id), bytes_stored: buf.length },
    { status: 201 }
  );
}
