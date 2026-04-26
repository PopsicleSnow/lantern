# lantern-bounty

Anchor program that escrows SOL bounties for journalist beats. Tippers whose tips
are marked `closed` can claim a bounty to a fresh ephemeral wallet generated in
their browser. The server holds the only key authorized to call `claim_bounty`,
which lets the platform enforce its MongoDB-side check (tip status + nullifier
match) before any chain interaction.

## One-time setup

```bash
# Install Solana + Anchor toolchains
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.31.1 --locked --force

# Generate a wallet for deploying (or reuse ~/.config/solana/id.json)
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
solana config set --url devnet
solana airdrop 2

# Generate the server claim authority keypair
node ../scripts/keygen-claim-authority.js
# Copy `Public key` into NEXT_PUBLIC_SOLANA_CLAIM_AUTHORITY_PUBKEY in .env.local
# Copy `Secret (base58)` into SOLANA_CLAIM_AUTHORITY_KEYPAIR
# Then airdrop the claim authority some SOL for tx fees:
solana airdrop 1 <claim_authority_pubkey>
```

## Build + deploy

```bash
cd solana

# 1. First build — Anchor generates target/deploy/lantern_bounty-keypair.json
anchor build

# 2. Sync the freshly-generated program id into declare_id!() and Anchor.toml.
#    This is the right way; manually editing both files is error-prone.
anchor keys sync

# 3. Re-build with the synced id, then deploy to devnet.
anchor build
anchor deploy --provider.cluster devnet

# 4. Record the program id into .env.local:
solana address -k target/deploy/lantern_bounty-keypair.json
#   SOLANA_PROGRAM_ID=<pubkey>
#   NEXT_PUBLIC_SOLANA_PROGRAM_ID=<pubkey>
```

> The placeholder `Bounty11111111111111111111111111111111111111` shipped in
> `lib.rs`/`Anchor.toml` is just a valid 32-byte base58 string so the source
> compiles before the first `anchor keys sync`. Do not deploy with it — every
> Anchor program ships its id in the binary, and a real deploy needs the real
> pubkey from `target/deploy/lantern_bounty-keypair.json`.

## TS client

The Next.js app uses a hand-written instruction encoder in
`lib/solana/program.ts` that does not depend on Anchor's IDL JSON, so the app
runs even before the program is deployed (the bounty board just renders empty).
Once the program is live and `NEXT_PUBLIC_SOLANA_PROGRAM_ID` is set, the client
will discover pools and decode their state.

## Manual instruction layout

| Instruction       | Discriminator (sha256("global:<name>")[..8]) | Args (Borsh)                              |
|-------------------|----------------------------------------------|-------------------------------------------|
| `create_bounty`   | `7a 5a 0e 8f 08 7d c8 02`                    | `string beat_slug, u64 amount, u32 max`   |
| `claim_bounty`    | `e1 9d a3 ee ef a9 4b e2`                    | `[u8;32] claim_hash, string beat_slug`    |
| `close_bounty`    | `5a 21 cd 6e d2 16 f7 31`                    | `string beat_slug`                        |
| `top_up_bounty`   | `5c da ba 8e 5e bf 9b f2`                    | `string beat_slug, u32 additional_claims` |

| Account         | Discriminator                          |
|-----------------|----------------------------------------|
| `BountyPool`    | `24 17 8d c8 fe 47 29 ab`              |
| `ClaimReceipt`  | `df e9 0b e5 7c a5 cf 1c`              |

PDAs:
- `BountyPool` — `["bounty_pool", journalist_pubkey, beat_slug]`
- `ClaimReceipt` — `["claim", claim_hash]`
