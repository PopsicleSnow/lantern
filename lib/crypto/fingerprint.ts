import { decodeBase64 } from 'tweetnacl-util';

export async function fingerprintPublicKey(public_key_b64: string): Promise<string> {
  const bytes = decodeBase64(public_key_b64);
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function shortFingerprint(full: string): string {
  return full.slice(0, 16).match(/.{1,4}/g)?.join(' ') ?? full;
}
