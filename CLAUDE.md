# CLAUDE.md — Lantern: Anonymous Whistleblower Platform

---

## Build Priority

**Phase 1 (primary):** Web/desktop app — Next.js + World ID 4.0 + browser edge AI + TweetNaCl E2EE + Fetch.ai + ASI:One + MongoDB Atlas
**Phase 2 (stretch):** Solana bounty escrow
**Phase 3 (stretch):** React Native mobile app with ZETIC Melange on-device classification (replaces browser edge AI on mobile)

Phases 2 and 3 are independent. All phases share the same backend API and MongoDB instance.

---

## Project Overview

Lantern is an anonymous, end-to-end-encrypted whistleblower/tip submission platform.

- **Tippers** classify their tip in their own browser (Transformers.js + ONNX Runtime Web), prove humanity via World ID, and encrypt the tip to one or more journalist public keys (TweetNaCl `box`) before submitting. The cleartext never leaves the browser.
- **The server** stores ciphertexts + structural metadata only (length, category, confidence, has_dates, structural_quality, ...). It cannot decrypt tips.
- **Fetch.ai** receives metadata + trust signals (verified_human, source credibility) and decides priority + which journalist gets routed. It calls **ASI:One** as its LLM — but only on metadata, never cleartext.
- **Journalists** generate a TweetNaCl keypair on first login. The private key is encrypted with a passphrase (PBKDF2-SHA256 → secretbox) and stored in IndexedDB on their device. A backup `.json` file is offered for recovery. The public key is uploaded to the server and listed on a public `/transparency` page so sources can verify the key wasn't substituted.
- **Tippers** can check `/status?tip_id=...` to see whether a journalist has read their tip — without learning which one.
- **Source credibility** per nullifier is updated when journalists rate tips (`valuable` / `dismissed`). The score feeds back into Fetch.ai's priority decision on future tips from the same nullifier.

**Relationship to SecureDrop:** SecureDrop solves secure document transfer to a *known* newsroom. Lantern solves finding *which* journalist to approach. After a tip is routed and read, the journalist dashboard surfaces their SecureDrop URL so the source can follow up with documents through the established secure channel.

**Core guarantee:** A verified human submitted this tip. Only the intended journalist(s) can read it. The platform never knows *who*, and the platform itself cannot read the tip.

---

## Architecture Overview

```
TIPPER (browser)
  Step 1  Write content
  Step 2  World ID (optional) → nullifier
  Step 3  Edge AI: Transformers.js + ONNX Runtime Web (+ WebGPU if available)
            - Xenova/distilbert-base-uncased-mnli (zero-shot classification)
            - Xenova/all-MiniLM-L6-v2 (embeddings → structural quality)
            → metadata: { category, confidence, beats, urgency, word_count,
                          has_entities, has_dates, has_specifics,
                          structural_quality, entity_count, date_count,
                          money_mentions }
  Step 4  POST /api/tips/metadata { metadata, idkit_response }
            ← server: persist Tip in 'awaiting_ciphertext'
            ← Fetch.ai: decide priority + recipients (uses ASI:One on metadata)
            ← { tip_id, recipients: [{ journalist_id, public_key }] }
  Step 5  Encrypt cleartext to each recipient (TweetNaCl box, ephemeral keypair)
  Step 6  POST /api/tips/{tip_id}/ciphertext { ciphertexts: [...] }
            ← status flips to 'routed' or 'human_review'
  Cleartext NEVER leaves the browser.

SERVER (Next.js, MongoDB)
  Stores: ciphertexts + metadata + nullifier hash + status + read_at
  Cannot decrypt anything.

FETCH.AI AGENT (Python, FastAPI on :8000, uAgents on :8001)
  /triage receives metadata only.
  Calls ASI:One on metadata JSON to choose priority + journalist.
  Falls back to deterministic rules if ASI:One unavailable.
  Chat Protocol unchanged for Agentverse demo.

JOURNALIST (browser)
  First login: passphrase → generate TweetNaCl keypair → encrypt secret key with
               PBKDF2-derived key → secretbox → store in IndexedDB. Download .json
               backup. Upload public key to server.
  Returning login: enter passphrase → unlock secret key from IndexedDB.
  Dashboard: list metadata; on click, fetch the ciphertext entry matching this
             journalist_id, decrypt in-browser, mark read_at.
  Rate tip: 'valuable' / 'dismissed' → updates nullifier credibility.

PUBLIC PAGES
  /transparency  — every journalist's public key + SHA-256 fingerprint
  /status        — tipper enters tip_id, sees status + read indicator
```

---

## Phase 1 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16.2.4 (App Router) | UI + API routes |
| Proof of Humanity | World ID IDKit v4 (`@worldcoin/idkit@^4`) | Anti-bot, nullifier anonymity |
| RP Signing | `@worldcoin/idkit-server` | Server-side ECDSA RP context |
| Edge AI | `@xenova/transformers` (ONNX Runtime Web + WebGPU fallback to WASM) | In-browser classification + quality metadata |
| E2EE | `tweetnacl` + `tweetnacl-util` | `box` for tip encryption, `secretbox` for passphrase wrap |
| KDF | WebCrypto PBKDF2-SHA256 (600k iterations) | Passphrase → key for wrapping the secret key |
| Keystore | `idb` (IndexedDB) | Stores the encrypted secret key locally |
| Agent Framework | Fetch.ai uAgents (Python) | Metadata-only triage, registered on Agentverse |
| Priority LLM | ASI:One LLM (`asi1` model) | Called by Fetch.ai on metadata only |
| Database | MongoDB Atlas (Mongoose) | Tips (ciphertext + metadata), journalists, credibility |
| Styling | Inline CSS variables + Tailwind v4 | Dark editorial theme |

---

## Implementation Notes

- **Cleartext never leaves the browser.** This rule is enforced at the API surface: `/api/tips/metadata` accepts metadata only, `/api/tips/{id}/ciphertext` accepts ciphertexts only. There is no endpoint that takes cleartext tip content. Old `POST /api/tips` is removed.
- **Edge AI:** `lib/edge-ai/classify.ts` wraps Transformers.js zero-shot classification; `lib/edge-ai/quality.ts` runs the embedding model + heuristic detectors (date/money/entity regexes) to produce metadata. WebGPU is preferred but falls back to WASM. First load downloads ~60–100 MB; cached afterward.
- **Encryption primitives:** TweetNaCl `box` uses curve25519+xsalsa20+poly1305. We generate an ephemeral sender keypair per encryption and store `{ ciphertext, nonce, ephemeral_pubkey }` per recipient.
- **Passphrase wrap:** `lib/crypto/passphrase.ts` derives a 32-byte key with WebCrypto PBKDF2-SHA256 (600k iterations) and wraps the secret key with `nacl.secretbox`. The encrypted blob (`{ version, kdf, iterations, salt, nonce, ciphertext }`) lives in IndexedDB under `lantern-keystore/journalist-keys`.
- **Backup file:** A signed-out journalist can restore by uploading their `lantern-key-{journalist_id}.json` and choosing a new passphrase. There is no other recovery — losing the passphrase + backup means losing access to all routed tips forever.
- **Two-pass submit:** The browser cannot encrypt to journalists until the server returns recipient pubkeys. Step 1 is metadata-only; step 2 is ciphertext-only. The DB has an intermediate `awaiting_ciphertext` status.
- **Credibility scoring:** `lib/credibility.ts` tracks `total_tips`, `valuable_count`, `dismissed_count` per nullifier. Score = `(valuable + 1) / (valuable + dismissed + 2)` (Laplace smoothing, default 0.5). Captured into `Tip.credibility_at_submission` for Fetch.ai input.
- **Status tracking:** `read_at` and `read_by_journalist_id` are set when a journalist successfully decrypts. `/api/tips/{id}/status` is public and exposes only `{ status, created_at, read, read_at, priority, category }` — never the journalist identity.
- **World ID is IDKit v4 (World ID 4.0)** — uses `IDKitRequestWidget` + `orbLegacy()` preset. Requires server-side ECDSA RP context via `@worldcoin/idkit-server`. Two server routes: `POST /api/worldid/rp-context` and `POST /api/worldid/verify`. `allow_legacy_proofs: true` through June 1 2026.
- **ASI:One usage:** Fetch.ai calls ASI:One inside `agents/gemma_client.py` (`decide_priority`). Filename retained for historical reasons; the cleartext-classification function it used to expose is gone. Prompt receives metadata + verified_human + credibility only.
- **Tip model fields:** `metadata` (full edge-AI output), `ciphertexts` (per-recipient), `read_at`, `read_by_journalist_id`, `credibility_at_submission`. Removed: `content`, `ai_summary`, `zetic_classification`. `classification_source` enum: `'edge_ai' | 'asi1_meta' | 'manual'`.
- **Journalist model adds:** `public_key`, `public_key_fingerprint`, `key_uploaded_at`. Seed script seeds journalists *without* keys; they generate one on first dashboard login.
- **Next.js version is 16.2.4.**
- **Seed script:** `npm run seed` — seeds 4 journalists. Requires `dotenv` (dev dep) because `tsx` does not load `.env.local` automatically.
- **Python agent ports:** FastAPI (`/triage`) on **port 8000**, uAgents on **port 8001**. Both start from `python main.py`. The `/triage` schema is now metadata-only (`MetadataPayload` in `agents/main.py`).
- **Python 3.13 + aiohttp mailbox bug:** `uagents` mailbox connection throws a brotli decompression error on Python 3.13. Does not affect `/triage` endpoint. Use 3.11/3.12 if Agentverse mailbox is needed.

---

## Phase 1 Directory Structure

```
lantern/
├── app/
│   ├── page.tsx                                ← Landing
│   ├── submit/page.tsx                         ← Tip submission
│   ├── status/page.tsx                         ← Tipper status check
│   ├── transparency/page.tsx                   ← Public pubkey list
│   ├── journalist/
│   │   ├── layout.tsx                          ← Wraps with SessionProvider
│   │   ├── page.tsx                            ← Dashboard + keypair gate
│   │   └── [id]/page.tsx                       ← Tip detail + decryption
│   ├── admin/review/page.tsx                   ← Metadata-only review queue
│   └── api/
│       ├── tips/
│       │   ├── metadata/route.ts               ← POST: step 1 (metadata)
│       │   └── [id]/
│       │       ├── route.ts                    ← GET (per-journalist ciphertext)
│       │       ├── ciphertext/route.ts         ← POST: step 2 (ciphertext)
│       │       ├── status/route.ts             ← GET: public status
│       │       ├── rate/route.ts               ← PATCH: rate
│       │       └── read/route.ts               ← POST: mark read
│       ├── worldid/
│       │   ├── rp-context/route.ts
│       │   └── verify/route.ts
│       ├── journalist/
│       │   ├── tips/route.ts                   ← Metadata list
│       │   ├── profile/route.ts
│       │   └── key/route.ts                    ← GET/POST pubkey
│       ├── transparency/route.ts               ← Public pubkey list
│       └── admin/review/route.ts
│
├── components/
│   ├── TipSubmissionForm.tsx                   ← 4-step form (Write/Verify/Analyze/Submit)
│   ├── EdgeAIProgress.tsx                      ← Model-load + encryption progress
│   ├── WorldIDButton.tsx
│   ├── TipCard.tsx                             ← Metadata-only listing card
│   ├── PriorityBadge.tsx
│   ├── ReviewQueue.tsx
│   ├── SecureDropPrompt.tsx
│   └── journalist/
│       ├── KeypairSetup.tsx                    ← First-login generation + backup
│       ├── PassphraseUnlock.tsx                ← Returning-login unlock
│       ├── RestoreFromBackup.tsx               ← Restore from .json on new browser
│       └── RatingControls.tsx                  ← Valuable / dismissed
│
├── lib/
│   ├── mongodb.ts
│   ├── worldid.ts
│   ├── agent-client.ts                         ← triageWithAgent (synchronous)
│   ├── triage.ts                               ← Server-side fallback rules
│   ├── credibility.ts                          ← Score helpers
│   ├── crypto/
│   │   ├── keypair.ts                          ← TweetNaCl box helpers
│   │   ├── passphrase.ts                       ← PBKDF2 + secretbox
│   │   ├── keystore.ts                         ← IndexedDB wrapper
│   │   └── fingerprint.ts                      ← SHA-256 fingerprint
│   ├── edge-ai/
│   │   ├── runtime.ts                          ← WebGPU detection + env config
│   │   ├── classify.ts                         ← Zero-shot pipeline
│   │   └── quality.ts                          ← Embedder + heuristic metadata
│   ├── journalist/
│   │   └── session.tsx                         ← React Context for unlocked key
│   └── models/
│       ├── Tip.ts
│       ├── Journalist.ts
│       ├── NullifierLog.ts
│       └── Credibility.ts                      ← New
│
├── agents/                                     ← Python Fetch.ai agent
│   ├── main.py                                 ← FastAPI on :8000 + uAgents on :8001
│   ├── triage_agent.py                         ← Metadata-only triage
│   ├── gemma_client.py                         ← ASI:One on metadata (decide_priority)
│   ├── journalist_store.py                     ← Returns journalists with pubkeys
│   └── requirements.txt
│
└── scripts/
    └── seed-journalists.ts
```

---

## Environment Variables

`.env.local`:

```bash
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/lantern

NEXT_PUBLIC_WLD_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_WLD_ACTION=submit-tip
WLD_RP_ID=rp_xxxxxxxxxxxxxxxxxxxxxxxx
WLD_RP_SIGNING_KEY=0x...
NEXT_PUBLIC_WLD_ENVIRONMENT=staging

ASI1_API_KEY=
AGENT_ENDPOINT=http://localhost:8000/triage
AGENTVERSE_API_KEY=

SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=
```

Python agent `agents/.env`:

```bash
MONGODB_URI=
ASI1_API_KEY=
AGENTVERSE_API_KEY=
AGENT_SEED=<random hex — run: python3 -c "import secrets; print(secrets.token_hex(32))">
```

---

## Data Models

### `Tip` (MongoDB)

```typescript
export interface ITip {
  nullifier_hash: string;
  metadata: {
    category, confidence, beats, urgency,
    word_count, char_count,
    has_entities, has_dates, has_specifics,
    structural_quality,
    entity_count, date_count, money_mentions,
  };
  ciphertexts: { journalist_id, ciphertext, nonce, ephemeral_pubkey }[];
  verified_human: boolean;
  priority: 'high' | 'standard';
  status: 'awaiting_ciphertext' | 'pending' | 'routed' | 'human_review' | 'closed';
  category, category_confidence, beats_matched, urgency;
  classification_source: 'edge_ai' | 'asi1_meta' | 'manual';
  assigned_journalist_id?, read_at?, read_by_journalist_id?;
  credibility_at_submission?: number;
  created_at, updated_at;
}
```

### `Journalist` (MongoDB)

```typescript
export interface IJournalist {
  name, organization, beats[];
  email_hash, email_encrypted;
  securedrop_url?;
  public_key?, public_key_fingerprint?, key_uploaded_at?;
  verified, active, tip_count;
}
```

### `Credibility` (MongoDB)

```typescript
export interface ICredibility {
  nullifier_hash;             // unique
  total_tips, valuable_count, dismissed_count;
  score;                      // (valuable + 1) / (valuable + dismissed + 2)
  last_updated;
}
```

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/tips/metadata` | POST | Step 1: persist metadata, get recipient pubkeys |
| `/api/tips/[id]/ciphertext` | POST | Step 2: attach ciphertexts |
| `/api/tips/[id]` | GET | Per-journalist ciphertext + metadata (auth required) |
| `/api/tips/[id]/status` | GET | Public status (no journalist identity) |
| `/api/tips/[id]/rate` | PATCH | Journalist rates tip (valuable/dismissed) |
| `/api/tips/[id]/read` | POST | Journalist marks tip read |
| `/api/journalist/key` | GET/POST | Journalist's public key |
| `/api/journalist/tips` | GET | Routed-tip metadata list |
| `/api/journalist/profile` | GET | Profile + SecureDrop URL |
| `/api/transparency` | GET | Public list of journalist pubkeys |
| `/api/worldid/rp-context` | POST | Signed RP context for IDKit |
| `/api/worldid/verify` | POST | Proxy to World ID v4 |
| `/api/admin/review` | GET/PATCH | Metadata-only review queue + reassign within recipient set |

---

## Phase 1 Build Order

1. ✅ MongoDB Atlas — models (Tip, Journalist, NullifierLog, Credibility), seed script
2. ✅ World ID — IDKit v4 widget + RP context + verify routes
3. ✅ Crypto library — TweetNaCl + PBKDF2 + IndexedDB keystore
4. ✅ Edge AI — Transformers.js classify + quality metadata
5. ✅ ASI:One — moved to metadata-only inside Fetch.ai agent
6. ✅ Fetch.ai agent — metadata-only `/triage`, returns recipients
7. ⬜ Register on Agentverse — note agent address for Devpost
8. ✅ Two-pass tip submission — `/api/tips/metadata` + `/api/tips/[id]/ciphertext`
9. ✅ Frontend — submission form (4 steps with edge AI + encryption)
10. ✅ Journalist dashboard — keypair gate (setup / unlock / restore) + decryption
11. ✅ Admin review queue — metadata only; reassign within recipient set
12. ✅ Public pages — `/transparency` + `/status`
13. ⬜ Figma Make — document design process

---

## Testing Checklist

### Phase 1 (Web)
- [ ] Each seeded journalist generates a keypair on first login; `.json` backup downloads
- [ ] Reload journalist dashboard → passphrase unlock works
- [ ] `/transparency` shows all journalist pubkeys + fingerprints
- [ ] Submit tip without World ID → `verified_human: false`, `priority: standard`
- [ ] Submit tip with World ID staging → `verified_human: true`, `priority: high` if metadata is strong
- [ ] Network tab confirms NO field named `content` ever leaves the browser
- [ ] MongoDB inspection: `tips.content` does not exist; `tips.ciphertexts[].ciphertext` is opaque
- [ ] Submit 4 tips with same nullifier → 4th returns 429
- [ ] Vague tip → confidence < 0.55 → `status: human_review`
- [ ] Journalist dashboard lists metadata; click → tip decrypts in-browser; `read_at` is set
- [ ] `/status?tip_id=...` shows `routed` + `read` after step above
- [ ] Journalist rates tip `valuable` → `Credibility` score increases for that nullifier
- [ ] Second tip from same nullifier shows boosted `credibility_at_submission`
- [ ] Non-recipient journalist GET `/api/tips/{id}?journalist_id=other` → 403
- [ ] Admin reassignment is rejected if target journalist isn't in `tip.ciphertexts`
- [ ] Fetch.ai Chat Protocol responds to "review queue", "routed tips", "total tips"
- [ ] Agent visible on Agentverse

---

## Notes & Caveats

- **Email notifications:** Stub — `console.log` journalist name + tip ID
- **Journalist auth:** `Authorization: Bearer demo-token` for demo
- **World ID staging:** Set `NEXT_PUBLIC_WLD_ENVIRONMENT=staging` for World App simulator
- **ASI:One rate limits:** If Fetch.ai latency is high, check API key quota at asi1.ai
- **Agent hosting:** Run locally. `ngrok http 8001` exposes uAgents for Agentverse. Next.js → agent uses `AGENT_ENDPOINT=http://localhost:8000/triage`
- **Python version:** Use 3.11 or 3.12 (3.13 has an aiohttp/brotli bug for the Agentverse mailbox)
- **Forgotten passphrase:** No recovery exists. Users must keep their `.json` backup. This is an explicit design choice.

---

## Phase 2 — Solana Stretch Goal

Journalists escrow SOL to signal what tips they want. Submitters claim bounty after a tip is marked "investigated."

```
create_bounty(beat, amount) → BountyAccount { journalist_pubkey, beat, amount, active }
claim_bounty(tip_id)        → releases escrow to submitter wallet
close_bounty()              → journalist reclaims unclaimed escrow
```

---

## Phase 3 — ZETIC Melange Mobile App (React Native)

Build only after Phase 1 is fully demoing. Separate app in `/mobile`.

- Expo SDK 51+ with `expo-dev-client` (ZETIC requires native modules)
- World ID: `@worldcoin/idkit-react-native`
- ZETIC Melange: `@zetic/mlange` — runs ONNX text classifier on-device
- Same E2EE story: tip is encrypted on device to journalist pubkeys before upload
- The web edge-AI library (`lib/edge-ai/`) is replaced by ZETIC on mobile, but produces the same `metadata` shape so the backend doesn't change
