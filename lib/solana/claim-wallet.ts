import { Keypair } from '@solana/web3.js';

// One-shot ephemeral wallet for receiving a bounty payout. The wallet has no
// prior on-chain history; once funded the tipper is expected to sweep funds to
// their main wallet. NEVER persist the secret key — only show it to the user
// at claim time and expect them to copy it.
export function generateClaimWallet(): { publicKey: string; secretKey: string } {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: Buffer.from(kp.secretKey).toString('base64'),
  };
}

// Mirror of the server's `crypto.createHash('sha256').update(tip_id + nullifier_hash).digest()`.
// Used by the browser to verify that the on-chain ClaimReceipt matches its claim.
export async function computeClaimHash(
  tipId: string,
  nullifierHash: string
): Promise<Uint8Array> {
  const data = new TextEncoder().encode(tipId + nullifierHash);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}
