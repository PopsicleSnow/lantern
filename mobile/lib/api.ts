import { getApiBase } from './edge-ai/runtime';
import type {
  ITipMetadata,
  ITipPreferences,
  MetadataResponse,
} from './types';
import type { EncryptedPayload } from './crypto/keypair';

export async function postMetadata(args: {
  metadata: ITipMetadata;
  idkit_response?: Record<string, unknown>;
  preferences?: ITipPreferences;
}): Promise<MetadataResponse> {
  const res = await fetch(`${getApiBase()}/api/tips/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (res.status === 429) {
    throw new RateLimitError('You have reached the submission limit for this period.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Metadata POST failed: ${res.status}`);
  }
  return (await res.json()) as MetadataResponse;
}

export async function postCiphertexts(
  tipId: string,
  ciphertexts: Array<{ journalist_id: string } & EncryptedPayload>
): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/tips/${tipId}/ciphertext`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertexts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Ciphertext POST failed: ${res.status}`);
  }
}

export async function fetchRpContext(): Promise<Record<string, unknown>> {
  const res = await fetch(`${getApiBase()}/api/worldid/rp-context`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to fetch World ID RP context');
  return (await res.json()) as Record<string, unknown>;
}

export async function verifyWorldId(idkit_response: Record<string, unknown>): Promise<{
  success: boolean;
  nullifier?: string;
}> {
  const res = await fetch(`${getApiBase()}/api/worldid/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idkit_response }),
  });
  const data = (await res.json()) as { success?: boolean; nullifier?: string; detail?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.detail ?? 'World ID verification failed');
  }
  return { success: !!data.success, nullifier: data.nullifier };
}

export class RateLimitError extends Error {}
