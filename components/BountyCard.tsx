'use client';

import Link from 'next/link';
import { BEAT_LABELS, type BeatSlug } from '@/lib/solana/beats';

export interface BountyCardData {
  pda: string;
  journalist_id: string;
  journalist_name: string;
  organization: string;
  journalist_solana_pubkey: string;
  beat_slug: BeatSlug;
  amount_per_claim_sol: number;
  claims_remaining: number;
  claims_paid: number;
  max_claims: number;
}

export default function BountyCard({ bounty }: { bounty: BountyCardData }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--accent)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '0.25rem',
            }}
          >
            {BEAT_LABELS[bounty.beat_slug] ?? bounty.beat_slug}
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.1rem',
              color: 'var(--text-primary)',
            }}
          >
            {bounty.journalist_name}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              marginTop: '0.15rem',
            }}
          >
            {bounty.organization}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.4rem',
              color: 'var(--accent)',
            }}
          >
            {bounty.amount_per_claim_sol.toFixed(3)} SOL
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
            }}
          >
            per closed tip
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          {bounty.claims_remaining} of {bounty.max_claims} claims remaining
        </span>
        <span style={{ wordBreak: 'break-all', fontSize: '0.65rem', opacity: 0.7 }}>
          pool {bounty.pda.slice(0, 8)}…{bounty.pda.slice(-4)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link
          href={`/submit?beat=${bounty.beat_slug}&journalist=${bounty.journalist_id}`}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#0a0a0a',
            border: 'none',
            padding: '0.5rem 0.85rem',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Submit a tip →
        </Link>
        <a
          href={`https://explorer.solana.com/address/${bounty.pda}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            padding: '0.5rem 0.85rem',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          View on chain
        </a>
      </div>
    </div>
  );
}
