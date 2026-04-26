![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

1. Copy .env.local.example → .env.local and fill in MONGODB_URI,
  NEXT_PUBLIC_WLD_APP_ID, NEXT_PUBLIC_WLD_ACTION, GOOGLE_AI_API_KEY
  2. npm run seed — seeds 4 journalists into MongoDB
  3. cd agents && pip install -r requirements.txt && python main.py — starts the Fetch.ai
   triage agent on port 8000
  4. npm run dev
