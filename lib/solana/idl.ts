// Hand-maintained IDL summary for the lantern_bounty Anchor program.
// The TS client (`lib/solana/program.ts`) does NOT depend on this file at runtime — it
// builds instructions/decodes accounts directly. This file exists for documentation
// and as a reference if you ever switch to `@coral-xyz/anchor`'s Program client.
//
// After you run `anchor build`, the canonical IDL JSON is at
// `solana/target/idl/lantern_bounty.json`. The shapes below should match that file.

export const LANTERN_BOUNTY_INSTRUCTION_DESCRIPTORS = {
  create_bounty: {
    discriminator: [122, 90, 14, 143, 8, 125, 200, 2],
    args: [
      { name: 'beat_slug', type: 'string' },
      { name: 'amount_per_claim', type: 'u64' },
      { name: 'max_claims', type: 'u32' },
    ],
  },
  claim_bounty: {
    discriminator: [225, 157, 163, 238, 239, 169, 75, 226],
    args: [
      { name: 'claim_hash', type: { array: ['u8', 32] } },
      { name: 'beat_slug', type: 'string' },
    ],
  },
  close_bounty: {
    discriminator: [90, 33, 205, 110, 210, 22, 247, 49],
    args: [{ name: 'beat_slug', type: 'string' }],
  },
  top_up_bounty: {
    discriminator: [92, 218, 186, 142, 94, 191, 155, 242],
    args: [
      { name: 'beat_slug', type: 'string' },
      { name: 'additional_claims', type: 'u32' },
    ],
  },
} as const;

export const LANTERN_BOUNTY_ACCOUNT_DESCRIPTORS = {
  BountyPool: {
    discriminator: [36, 23, 141, 200, 254, 71, 41, 171],
    fields: [
      { name: 'journalist', type: 'pubkey' },
      { name: 'claim_authority', type: 'pubkey' },
      { name: 'beat_slug', type: 'string' },
      { name: 'amount_per_claim', type: 'u64' },
      { name: 'max_claims', type: 'u32' },
      { name: 'claims_paid', type: 'u32' },
      { name: 'active', type: 'bool' },
      { name: 'bump', type: 'u8' },
    ],
  },
  ClaimReceipt: {
    discriminator: [223, 233, 11, 229, 124, 165, 207, 28],
    fields: [
      { name: 'claim_hash', type: { array: ['u8', 32] } },
      { name: 'pool', type: 'pubkey' },
      { name: 'paid_at', type: 'i64' },
    ],
  },
} as const;
