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

- **Tippers** classify their tip in their own browser (Transformers.js + ONNX Runtime Web), prove humanity via World ID, and encrypt the tip to one or more journalist public keys (TweetNaCl `box`) before submitting. The cleartext never leaves the browser. Tippers may optionally attach files (encrypted with the same hybrid envelope scheme — see Attachments) and pin routing to a specific category, newsgroup, and/or journalist.
- **The server** stores ciphertexts + structural metadata + opaque attachment blobs only. It cannot decrypt tips, files, or even original filenames.
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
  Step 4  POST /api/tips/metadata { metadata, idkit_response, preferences? }
            ← server: persist Tip in 'awaiting_ciphertext'
            ← Fetch.ai: decide priority + recipients (uses ASI:One on metadata)
                preferences narrow the recipient pool (journalist > org > category)
            ← { tip_id, recipients: [{ journalist_id, public_key }] }
  Step 5  Encrypt cleartext to each recipient (TweetNaCl box, ephemeral keypair)
  Step 5b For each attachment (optional, ≤5 files × 10MB):
            generate random content key →
            secretbox(file, nonce_f, content_key) →
            secretbox(filename, nonce_n, content_key) →
            for each recipient: box(content_key, recipient_pubkey) →
            POST /api/tips/{tip_id}/attachment (multipart: ciphertext + meta JSON)
  Step 6  POST /api/tips/{tip_id}/ciphertext { ciphertexts: [...] }
            ← status flips to 'routed' (when ≥1 recipient) or 'human_review' (zero recipients)
            ← assigned journalist's tip_count increments by 1
  Cleartext + file bytes NEVER leave the browser.

SERVER (Next.js, MongoDB)
  Stores: ciphertexts + metadata + nullifier hash + status + read_at + opaque attachment blobs
  Cannot decrypt anything (including filenames).

FETCH.AI AGENT (Python, FastAPI on :8000, uAgents on :8001)
  /triage receives metadata + optional preferences only.
  Calls ASI:One on metadata JSON to choose priority.
  Recipient pool: preferences-filtered if any; else beat-matched; else all-active.
  Falls back to deterministic rules if ASI:One unavailable.
  Chat Protocol unchanged for Agentverse demo.

JOURNALIST (browser)
  First login: passphrase → generate TweetNaCl keypair → encrypt secret key with
               PBKDF2-derived key → secretbox → store in IndexedDB. Download .json
               backup. Upload public key to server.
  Returning login: enter passphrase → unlock secret key from IndexedDB.
  Dashboard: list metadata; on click, fetch the ciphertext entry matching this
             journalist_id, decrypt body in-browser, mark read_at, decrypt each
             attachment's filename, click DOWNLOAD to fetch + decrypt file bytes.
  Rate tip: 'valuable' / 'dismissed' → updates nullifier credibility.

PUBLIC PAGES
  /transparency  — every journalist's public key + SHA-256 fingerprint
  /status        — tipper enters tip_id, sees status + read indicator
```

---

## Phase 1 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16.2.4 (App Router, webpack) | UI + API routes |
| Proof of Humanity | World ID IDKit v4 (`@worldcoin/idkit@^4`) | Anti-bot, nullifier anonymity |
| RP Signing | `@worldcoin/idkit-server` | Server-side ECDSA RP context |
| Edge AI | `@xenova/transformers` (ONNX Runtime Web + WebGPU fallback to WASM) | In-browser classification + quality metadata |
| E2EE | `tweetnacl` + `tweetnacl-util` | `box` for tip body + content-key wrap; `secretbox` for file/filename + passphrase wrap |
| KDF | WebCrypto PBKDF2-SHA256 (600k iterations) | Passphrase → key for wrapping the secret key |
| Keystore | `idb` (IndexedDB) | Stores the encrypted secret key locally |
| Agent Framework | Fetch.ai uAgents ≥0.24.2 (Python) | Metadata-only triage, registered on Agentverse |
| Priority LLM | ASI:One LLM (`asi1` model) | Called by Fetch.ai on metadata only |
| Database | MongoDB Atlas (Mongoose) | Tips (ciphertext + metadata), journalists, credibility |
| Styling | Inline CSS variables + Tailwind v4 | Dark editorial theme |

---

## Implementation Notes

- **Cleartext never leaves the browser.** This rule is enforced at the API surface: `/api/tips/metadata` accepts metadata + optional preferences only, `/api/tips/{id}/ciphertext` accepts ciphertexts only, `/api/tips/{id}/attachment` accepts only opaque ciphertext blobs + per-recipient wrapped keys (no plaintext, no plaintext filenames). There is no endpoint that takes cleartext tip content or file bytes. Old `POST /api/tips` is removed.
- **Edge AI:** `lib/edge-ai/classify.ts` wraps Transformers.js zero-shot classification; `lib/edge-ai/quality.ts` runs the embedding model + heuristic detectors (date/money/entity regexes) to produce metadata. WebGPU is preferred but falls back to WASM. First load downloads ~60–100 MB; cached afterward.
- **Encryption primitives:** TweetNaCl `box` uses curve25519+xsalsa20+poly1305. We generate an ephemeral sender keypair per encryption and store `{ ciphertext, nonce, ephemeral_pubkey }` per recipient.
- **Passphrase wrap:** `lib/crypto/passphrase.ts` derives a 32-byte key with WebCrypto PBKDF2-SHA256 (600k iterations) and wraps the secret key with `nacl.secretbox`. The encrypted blob (`{ version, kdf, iterations, salt, nonce, ciphertext }`) lives in IndexedDB under `lantern-keystore/journalist-keys`.
- **Backup file:** A signed-out journalist can restore by uploading their `lantern-key-{journalist_id}.json` and choosing a new passphrase. There is no other recovery — losing the passphrase + backup means losing access to all routed tips forever.
- **Two-pass submit (with optional attachment leg):** The browser cannot encrypt to journalists until the server returns recipient pubkeys. Step 1 is metadata-only; if files are picked, an interleaved attachment-upload leg runs per file (encrypt → multipart POST); step 2 is ciphertext-only. The DB has an intermediate `awaiting_ciphertext` status — attachments are only accepted while the tip is in this state.
- **Routing rule:** A tip is `routed` whenever the recipient pool is non-empty; the assigned journalist is `recipients[0]` (best beat match, lowest `tip_count` first in the Python agent). `human_review` is now reserved for the genuine zero-recipient case (e.g., the tipper picked a now-inactive journalist via preferences, or no journalists with keys exist for the chosen newsgroup). The earlier `confidence < 0.55 → human_review` gate has been removed; confidence still influences priority via ASI:One but no longer blocks routing.
- **Tipper routing preferences:** Optional `Tip.preferences = { category?, organization?, journalist_id? }`. Filtering precedence: a specific journalist locks the recipient pool to just that one; a newsgroup filters by `Journalist.organization`; a category narrows beats. Multiple preferences stack (most specific wins). Stored on the Tip for transparency/audit. Note: choosing a specific journalist/newsgroup *does* leak that choice to the server as metadata — the tip itself stays E2EE, but the routing intent is visible. The UI in `TipSubmissionForm` mirrors this in copy.
- **`tip_count` increment:** Incremented on the assigned journalist exactly once per tip, in the ciphertext POST handler (`app/api/tips/[id]/ciphertext/route.ts`) when status flips to `routed`. Doing it earlier (metadata step) would over-count tippers who bail before final submit. The Python agent's load-balancing sort (`journalist_store.py:.sort('tip_count', 1)`) only works once this is incrementing.
- **Encrypted attachments (envelope encryption):** Files use a hybrid scheme because TweetNaCl `box` is not chunked. Per file: (1) browser generates a random 32-byte content key, (2) `nacl.secretbox(file_bytes, file_nonce, content_key)` and `nacl.secretbox(filename, filename_nonce, content_key)`, (3) for each recipient, `nacl.box(content_key, key_nonce, recipient_pubkey, ephemeral_secret)` produces a wrapped key. Server stores: opaque file ciphertext + nonces + per-recipient wrapped keys + mime + size in a separate `Attachment` collection (`tip_id` ref). Caps: 10MB per file, 5 files per tip. GridFS is the right answer for larger files; current path stores binary as a `Buffer` field which is bounded by Mongo's 16MB document limit. Crypto helpers live in `lib/crypto/file.ts`.
- **Credibility scoring:** `lib/credibility.ts` tracks `total_tips`, `valuable_count`, `dismissed_count` per nullifier. Score = `(valuable + 1) / (valuable + dismissed + 2)` (Laplace smoothing, default 0.5). Captured into `Tip.credibility_at_submission` for Fetch.ai input.
- **Status tracking:** `read_at` and `read_by_journalist_id` are set when a journalist successfully decrypts. `/api/tips/{id}/status` is public and exposes only `{ status, created_at, read, read_at, priority, category }` — never the journalist identity.
- **World ID is IDKit v4 (World ID 4.0)** — uses `IDKitRequestWidget` + `orbLegacy()` preset. Requires server-side ECDSA RP context via `@worldcoin/idkit-server`. Two server routes: `POST /api/worldid/rp-context` and `POST /api/worldid/verify`. `allow_legacy_proofs: true` through June 1 2026.
- **ASI:One usage:** Fetch.ai calls ASI:One inside `agents/gemma_client.py` (`decide_priority`). Filename retained for historical reasons; the cleartext-classification function it used to expose is gone. Prompt receives metadata + verified_human + credibility only.
- **Tip model fields:** `metadata` (full edge-AI output), `ciphertexts` (per-recipient), `preferences?` (`{ category?, organization?, journalist_id? }`), `read_at`, `read_by_journalist_id`, `credibility_at_submission`. Removed: `content`, `ai_summary`, `zetic_classification`. `classification_source` enum: `'edge_ai' | 'asi1_meta' | 'manual'`. Attachments live in a separate collection keyed by `tip_id` — no embedded array on Tip.
- **Journalist model adds:** `public_key`, `public_key_fingerprint`, `key_uploaded_at`. Seed script seeds journalists *without* keys; they generate one on first dashboard login.
- **Next.js version is 16.2.4** — runs with **webpack** (not Turbopack). Next.js 16 defaults to Turbopack, which breaks `@xenova/transformers` browser stubs. Scripts use `--webpack` flag explicitly. Do not add `turbopack: {}` to `next.config.ts`.
- **Seed script:** `npm run seed` — seeds 4 journalists. Requires `dotenv` (dev dep) because `tsx` does not load `.env.local` automatically.
- **Python agent ports:** FastAPI (`/triage`) on **port 8000**, uAgents on **port 8001**. Both start from `python main.py`. The `/triage` schema is now metadata-only (`MetadataPayload` in `agents/main.py`).
- **Python version for agent:** Use 3.12 (`lantern` conda env). Python 3.13 has an aiohttp/brotli decompression bug that breaks the Agentverse mailbox connection. Does not affect the `/triage` FastAPI endpoint.
- **uAgents version:** Pin to `>=0.24.2`. Earlier 0.22.x builds a `RegistrationRequest` without the required `name` field added in `uagents-core` 0.4.x, causing a `ValidationError` on Agentverse registration. `uagents-ai-engine` is not used and must not be installed (it pins `uagents<0.23.0`).
- **MongoDB default DB:** If `MONGODB_URI` has no database path, Mongoose defaults to `test`. The Python agent uses `get_default_database()` with a `'test'` fallback in `agents/db.py` to match this.
- **AGENT_MAILBOX env var:** Set to `false` (or `0`/`no`/`off`) to start the uAgent without the Agentverse mailbox — useful for local testing. Set to `true` (or omit) for full Agentverse connectivity.

---

## Known Bug Fixes (preserve for future sessions)

### 1. `@xenova/transformers` — "Cannot convert undefined or null to object"
**Symptom:** Browser throws this error when the submission form tries to run edge AI after World ID verification.
**Root cause:** `@xenova/transformers/src/env.js` calls `Object.keys(fs)` at module level. Turbopack resolves `"browser": { "fs": false }` as a true empty ES module — so `import fs from 'fs'` returns `undefined`. Webpack's CJS interop gives `{}` instead, which is safe.
**Fix:**
- `next.config.ts`: use webpack `resolve.fallback` (`fs/path/url/crypto/stream/buffer: false`) + `asyncWebAssembly: true`. No `turbopack: {}`.
- `package.json`: add `--webpack` to `dev`, `build`, `start` scripts.
- `lib/edge-ai/runtime.ts`: set `env.backends.onnx.wasm.wasmPaths = '/ort-wasm/'`.
- `public/ort-wasm/`: copy WASM files from `onnxruntime-web/dist/` so they are served as static assets.

### 2. `@xenova/transformers` — SSR crash during server render
**Symptom:** Same error but on the server at build/render time.
**Fix:**
- All `import { pipeline } from '@xenova/transformers'` changed to `await import('@xenova/transformers')` inside async functions in `lib/edge-ai/*.ts`.
- `TipSubmissionForm` wrapped in `next/dynamic(..., { ssr: false })` in `app/submit/page.tsx`.

### 3. uAgents — `ValidationError: RegistrationRequest name field required`
**Symptom:** Agent starts but throws when trying to connect to the Agentverse mailbox or inspector.
**Root cause:** `uagents` 0.22.x builds `RegistrationRequest` without `name`, but `uagents-core` 0.4.x added `name` as required. `uagents` 0.24.x was updated to pass `name=self.name`.
**Fix:** `agents/requirements.txt` pins `uagents>=0.24.2`. Remove `uagents-ai-engine` (incompatible with 0.24.x and unused). Run `pip install "uagents==0.24.2"` in the `lantern` conda env.

### 4. Python agent — wrong MongoDB database
**Symptom:** Agent finds no journalists even though the DB has data.
**Root cause:** `MONGODB_URI` without a DB path makes Mongoose default to `test`, but the Python agent was connecting without specifying a DB.
**Fix:** `agents/db.py` uses `client.get_default_database()` with `'test'` as the fallback. Imported in `journalist_store.py` and `triage_agent.py`.

### 5. Next.js build — "Using Turbopack with a webpack config"
**Symptom:** `next build` fails when `turbopack: {}` and a `webpack: (config) => {}` function are both present in `next.config.ts`.
**Fix:** Never set both at once. Use webpack config only (no `turbopack: {}`), and add `--webpack` to npm scripts.

### 6. Mobile — `SyntaxError: Unexpected token 'export'` on `expo run:*`
**Symptom:** `npx expo run:ios` (or `run:android`) throws a bare `SyntaxError: Unexpected token 'export'` from Node's CJS loader (`loadESMFromCJS`) before Metro starts. No file path in the stack.
**Root cause:** A local Expo native module (`./modules/zetic-mlange`) was listed in `app.json` `expo.plugins`. Expo CLI tries to `require()` each plugin entry through Node directly (not Metro). Our module's `package.json` `main` points at `src/index.ts`, so Node tries to evaluate the TypeScript ESM file as CJS and chokes on the first `export`.
**Fix:** Native modules are auto-discovered by `expo prebuild` via `expo-module.config.json` — they should NOT be in the `plugins` array. The `plugins` array is only for *config plugins* (CJS functions that mutate the native projects). Removed `"./modules/zetic-mlange"` from `mobile/app.json`. If we ever need a real config plugin for the module (e.g. to auto-add the SPM package on iOS), it must live in a separate file (`app.plugin.js` at the module root) exported as a CJS function.

---

## Phase 1 Directory Structure

```
lantern/
├── app/
│   ├── page.tsx                                ← Landing
│   ├── submit/page.tsx                         ← Tip submission (ssr: false)
│   ├── status/page.tsx                         ← Tipper status check
│   ├── transparency/page.tsx                   ← Public pubkey list
│   ├── journalist/
│   │   ├── layout.tsx                          ← Wraps with SessionProvider
│   │   ├── page.tsx                            ← Dashboard + keypair gate
│   │   └── [id]/page.tsx                       ← Tip detail + decryption
│   ├── admin/review/page.tsx                   ← Metadata-only review queue
│   └── api/
│       ├── tips/
│       │   ├── metadata/route.ts               ← POST: step 1 (metadata + preferences)
│       │   └── [id]/
│       │       ├── route.ts                    ← GET (per-journalist ciphertext + attachments)
│       │       ├── ciphertext/route.ts         ← POST: step 2 (ciphertext) + tip_count++
│       │       ├── attachment/
│       │       │   ├── route.ts                ← POST: multipart upload (encrypted file)
│       │       │   └── [aid]/route.ts          ← GET: binary ciphertext download
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
│   │   ├── keypair.ts                          ← TweetNaCl box helpers (tip body)
│   │   ├── file.ts                             ← Hybrid envelope encryption for attachments
│   │   ├── passphrase.ts                       ← PBKDF2 + secretbox
│   │   ├── keystore.ts                         ← IndexedDB wrapper
│   │   └── fingerprint.ts                      ← SHA-256 fingerprint
│   ├── edge-ai/
│   │   ├── runtime.ts                          ← WebGPU detection + env config + wasmPaths
│   │   ├── classify.ts                         ← Zero-shot pipeline
│   │   └── quality.ts                          ← Embedder + heuristic metadata
│   ├── journalist/
│   │   └── session.tsx                         ← React Context for unlocked key
│   └── models/
│       ├── Tip.ts
│       ├── Attachment.ts
│       ├── Journalist.ts
│       ├── NullifierLog.ts
│       └── Credibility.ts
│
├── agents/                                     ← Python Fetch.ai agent
│   ├── main.py                                 ← FastAPI on :8000 + uAgents on :8001
│   ├── triage_agent.py                         ← Metadata-only triage
│   ├── gemma_client.py                         ← ASI:One on metadata (decide_priority)
│   ├── journalist_store.py                     ← Returns journalists with pubkeys
│   ├── db.py                                   ← get_db() with test-DB fallback
│   └── requirements.txt
│
├── public/
│   └── ort-wasm/                               ← WASM files served as static assets
│       ├── ort-wasm.wasm
│       ├── ort-wasm-simd.wasm
│       ├── ort-wasm-threaded.wasm
│       └── ort-wasm-simd-threaded.wasm
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
AGENT_MAILBOX=true   # set to false to skip Agentverse mailbox for local testing
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
  preferences?: { category?, organization?, journalist_id? };  // tipper-pinned routing
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

### `Attachment` (MongoDB)

```typescript
export interface IAttachment {
  tip_id: string;                   // ref to Tip._id
  file_ciphertext: Buffer;          // secretbox(file_bytes, file_nonce, content_key)
  file_nonce: string;
  filename_ciphertext: string;      // secretbox(filename, filename_nonce, content_key)
  filename_nonce: string;
  mime_type: string;
  file_size: number;
  wrapped_keys: {                   // one per recipient: box-wrapped content key
    journalist_id, key_ciphertext, key_nonce, ephemeral_pubkey
  }[];
  created_at: Date;
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
| `/api/tips/metadata` | POST | Step 1: persist metadata + optional preferences, get recipient pubkeys |
| `/api/tips/[id]/ciphertext` | POST | Step 2: attach ciphertexts; increments assigned journalist's `tip_count` |
| `/api/tips/[id]/attachment` | POST | Multipart upload of one encrypted attachment (only while `awaiting_ciphertext`) |
| `/api/tips/[id]/attachment/[aid]` | GET | Binary ciphertext download; gated by recipient set + `Bearer demo-token` |
| `/api/tips/[id]` | GET | Per-journalist ciphertext + metadata + attachment list (filtered to this journalist's wrapped key) |
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
11. ✅ Admin review queue — metadata only; reassign within recipient set (now mostly empty since `human_review` only fires on zero recipients)
12. ✅ Public pages — `/transparency` + `/status`
13. ✅ Tipper routing preferences — optional category/newsgroup/journalist on submit
14. ✅ Encrypted attachments — hybrid envelope encryption; per-recipient wrapped content keys
15. ⬜ Figma Make — document design process

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
- [ ] Tip with non-empty recipient pool → `status: routed` regardless of confidence; assigned journalist's `tip_count` increments by 1
- [ ] Tip with preferences pinning an inactive/keyless journalist → recipients=0 → `status: human_review` (lands on admin queue, never on a journalist dashboard)
- [ ] Tipper picks a specific journalist preference → only that journalist appears in `tip.ciphertexts` and receives the tip
- [ ] Tipper picks newsgroup only → recipients are restricted to journalists in that organization
- [ ] Journalist dashboard lists metadata; click → tip decrypts in-browser; `read_at` is set
- [ ] `/status?tip_id=...` shows `routed` + `read` after step above
- [ ] Journalist rates tip `valuable` → `Credibility` score increases for that nullifier
- [ ] Second tip from same nullifier shows boosted `credibility_at_submission`
- [ ] Non-recipient journalist GET `/api/tips/{id}?journalist_id=other` → 403
- [ ] Admin reassignment is rejected if target journalist isn't in `tip.ciphertexts`
- [ ] Submit tip with attachment → file ciphertext stored in `attachments` collection; original filename never appears in DB; recipient journalist sees decrypted filename + can download + decrypt
- [ ] Non-recipient journalist GET `/api/tips/{id}/attachment/{aid}?journalist_id=other` → 403
- [ ] Attachment > 10MB rejected with 413; > 5 attachments per tip rejected with 409
- [ ] POST attachment after tip moves out of `awaiting_ciphertext` → 409
- [ ] Fetch.ai Chat Protocol responds to "review queue", "routed tips", "total tips"
- [ ] Agent visible on Agentverse

---

## Notes & Caveats

- **Email notifications:** Stub — `console.log` journalist name + tip ID
- **Journalist auth:** `Authorization: Bearer demo-token` for demo
- **World ID staging:** Set `NEXT_PUBLIC_WLD_ENVIRONMENT=staging` for World App simulator
- **ASI:One rate limits:** If Fetch.ai latency is high, check API key quota at asi1.ai
- **Agent hosting:** Run locally with `conda activate lantern && cd agents && python main.py`. `ngrok http 8001` exposes uAgents for Agentverse. Next.js → agent uses `AGENT_ENDPOINT=http://localhost:8000/triage`
- **Python version:** Use the `lantern` conda env (Python 3.12). Python 3.13 has an aiohttp/brotli decompression bug for the Agentverse mailbox.
- **uAgents conda env:** `conda activate lantern` — has Python 3.12.13 and uagents 0.24.2. Do not use base env (Python 3.13).
- **Forgotten passphrase:** No recovery exists. Users must keep their `.json` backup. This is an explicit design choice. (Includes attachments — losing the secret key means losing the wrapped content keys for every received attachment.)
- **Attachment size cap:** 10MB per file, 5 files per tip. Hard-coded in `app/api/tips/[id]/attachment/route.ts` and mirrored in `components/TipSubmissionForm.tsx`. Larger files need GridFS — current path stores the binary in a `Buffer` field bounded by Mongo's 16MB document limit.
- **Routing preference leakage:** `Tip.preferences` is stored on the server in cleartext. The tip body and any files stay E2EE, but the *fact that a tipper picked Journalist X or Newsgroup Y* is server-visible metadata. The submission UI states this. If stronger anonymity is required for a particular flow, filter the recipient pool client-side before encrypting and don't send `preferences`.
- **WASM files:** `public/ort-wasm/*.wasm` are copied from `onnxruntime-web/dist/`. If you reinstall `onnxruntime-web`, re-copy them: `cp node_modules/onnxruntime-web/dist/*.wasm public/ort-wasm/`
- **Webpack vs Turbopack:** Always run with `--webpack`. Next.js 16 defaults to Turbopack which breaks `@xenova/transformers` browser stubs. The `--webpack` flag is baked into `package.json` scripts.

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

Scaffolded in `/mobile` (Expo SDK 52 + dev client). MVP scope: write → World ID (or skip) → classify → submit. No attachments, no preferences, no /status screen.

- **Expo SDK 52** with `expo-dev-client` and Expo Router
- **ZETIC.MLange** via a **custom Expo native module** at `mobile/modules/zetic-mlange/` (the published `react-native-zetic-mlange` npm package only targets the LLAMA_CPP / LLM template; we wrap `ZeticMLangeModel` directly for the small classifier path). Native deps: `com.zeticai.mlange:mlange:1.6.1` (Android, gradle) and `https://github.com/zetic-ai/ZeticMLangeiOS.git` exact `1.6.0` (iOS, Swift Package Manager — added manually in Xcode after `expo prebuild`). JS surface: `loadModel(personalKey, modelName, version?, modelMode?)` → handle, `run(handle, inputs: JSTensor[])` → `JSTensor[]` where `JSTensor = { shape, dtype: 'int32'|'int64'|'float32', data: Uint8Array }`.
- **Model:** `Steve/distilbert-base-multilingual-cased` v2 (already in the Mlange catalog). This is a **base encoder, not an MNLI head** — Xenova MNLI doesn't convert via Mlange.
- **Tokenizer:** pure-TS WordPiece (`mobile/lib/edge-ai/tokenizer.ts`) compatible with `AutoTokenizer.from_pretrained("distilbert-base-multilingual-cased")`. Configured **cased** (`doLowerCase: false, doStripAccents: false`). Vocab at `mobile/assets/distilbert-vocab.txt` (the cased multilingual `vocab.txt` from HuggingFace, ~119k tokens).
- **Classifier (`mobile/lib/edge-ai/classify.ts`):** since the model has no MNLI head, classification is done by **embedding similarity** — encode the tip text into a mean-pooled 768-dim embedding, encode each beat label the same way (cached after first run), cosine-similarity, then tempered softmax (`temperature=0.05`) for confidence. Returns the same `EdgeClassification` shape as the web pipeline plus the text embedding for reuse in `quality.ts`. First tip costs 8 model runs (7 labels + 1 text); subsequent tips cost 1.
- **Quality (`mobile/lib/edge-ai/quality.ts`):** when the embedding is available (always, in the normal flow), uses **web-parity weights** `0.25·length + 0.20·diversity + 0.20·sentence + 0.20·specificity + 0.15·norm` with `norm_score = min(1, ||embedding|| / 25)` (threshold tuned for distilbert-multilingual-cased — web uses 12 for all-MiniLM, different distribution). Falls back to `0.30/0.25/0.25/0.20` (no norm) if no embedding is supplied.
- **Crypto:** `mobile/lib/crypto/keypair.ts` is a verbatim copy of `lib/crypto/keypair.ts`. `react-native-get-random-values` is imported once at `index.js` so `nacl.randomBytes` works.
- **World ID:** `@worldcoin/idkit-react-native` via `mobile/components/WorldIDButton.tsx`; falls back gracefully if the package fails to resolve. Reuses the same `/api/worldid/rp-context` and `/api/worldid/verify` server routes.
- **Networking:** `EXPO_PUBLIC_API_BASE` in `app.json` extras; default `http://10.0.2.2:3000` for Android emulator. Same `/api/tips/metadata` + `/api/tips/{id}/ciphertext` endpoints as web.
- **Dtype assumption:** `classify.ts` packs token IDs as little-endian int64 (matches standard ONNX BERT export). Adjust `int32ToInt64Bytes` if the converted model expects int32.
- The web edge-AI library (`lib/edge-ai/`) is replaced by ZETIC on mobile, but produces the same `metadata` shape so the backend doesn't change.

See `mobile/README.md` for build/run instructions, model conversion steps, and verification checklist.
