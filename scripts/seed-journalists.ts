import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import dbConnect from '../lib/mongodb';
import Journalist from '../lib/models/Journalist';
import crypto from 'crypto';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const journalists = [
  {
    name: 'Alex Rivera',
    organization: 'The Chronicle',
    beats: ['financial_fraud', 'corporate'],
    email_hash: sha256('alex@chronicle.example'),
    email_encrypted: 'stub',
    securedrop_url: 'http://chronicle.securedrop.tor.onion',
    verified: true,
    active: true,
    tip_count: 0,
  },
  {
    name: 'Jordan Lee',
    organization: 'Environmental Watch',
    beats: ['environmental', 'health'],
    email_hash: sha256('jordan@envwatch.example'),
    email_encrypted: 'stub',
    securedrop_url: undefined,
    verified: true,
    active: true,
    tip_count: 0,
  },
  {
    name: 'Sam Washington',
    organization: 'Public Record',
    beats: ['government', 'national_security'],
    email_hash: sha256('sam@publicrecord.example'),
    email_encrypted: 'stub',
    securedrop_url: 'http://publicrecord.securedrop.tor.onion',
    verified: true,
    active: true,
    tip_count: 0,
  },
  {
    name: 'Morgan Chen',
    organization: 'Tech Oversight',
    beats: ['tech', 'corporate'],
    email_hash: sha256('morgan@techoversight.example'),
    email_encrypted: 'stub',
    securedrop_url: undefined,
    verified: true,
    active: true,
    tip_count: 0,
  },
];

async function seed() {
  await dbConnect();
  await Journalist.deleteMany({});
  const inserted = await Journalist.insertMany(journalists);
  console.log(`Seeded ${inserted.length} journalists:`);
  inserted.forEach((j) => console.log(`  ${j.name} (${j.organization}) — ID: ${j._id}`));
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
