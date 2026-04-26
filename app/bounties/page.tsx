import Link from 'next/link';
import BountyBoard from '@/components/BountyBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Lantern — Bounty board',
  description: 'Active SOL bounties offered by journalists for verified, closed tips.',
};

export default function BountyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          backgroundColor: 'var(--surface)',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            letterSpacing: '0.2em',
          }}
        >
          LANTERN
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Bounty Board
        </span>
        <Link
          href="/transparency"
          style={{
            marginLeft: 'auto',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textDecoration: 'underline',
          }}
        >
          Transparency
        </Link>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 2rem' }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '2rem',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}
        >
          Active bounties
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.7,
            marginBottom: '0.5rem',
          }}
        >
          Journalists fund SOL escrow on Solana to signal what kinds of tips they
          want. When a tip is investigated and marked closed, the original
          source — known only by their World ID nullifier — can claim the bounty
          to a fresh, single-use wallet generated in their browser.
        </p>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: '2rem',
          }}
        >
          The on-chain record links{' '}
          <code>(beat, journalist_pubkey, lamports, sha256(tip_id+nullifier))</code>.
          The tipper&apos;s identity, the tip body, and the nullifier itself never appear on-chain.
        </p>

        <BountyBoard />
      </div>
    </div>
  );
}
