export async function verifyWorldIDProof(
  idkitResponse: Record<string, unknown>
): Promise<{ success: boolean; nullifier?: string }> {
  const rpId = process.env.WLD_RP_ID;

  try {
    const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitResponse),
    });

    if (!res.ok) return { success: false };

    const data = await res.json();
    return { success: !!data.success, nullifier: data.nullifier };
  } catch {
    return { success: false };
  }
}
