'use client';

import { useEffect, useMemo, useState } from 'react';
import BountyCard, { type BountyCardData } from './BountyCard';
import { BEAT_SLUGS, BEAT_LABELS, type BeatSlug } from '@/lib/solana/beats';

interface ListResponse {
  configured: boolean;
  reason?: string;
  bounties: BountyCardData[];
}

export default function BountyBoard() {
  const [filter, setFilter] = useState<BeatSlug | 'all'>('all');
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');
    const url = filter === 'all' ? '/api/bounty' : `/api/bounty?beat=${filter}`;
    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `Request failed (${r.status})`);
        return json as ListResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load bounties');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const groupedByBeat = useMemo(() => {
    const groups = new Map<BeatSlug, BountyCardData[]>();
    for (const slug of BEAT_SLUGS) groups.set(slug, []);
    for (const b of data?.bounties ?? []) {
      const list = groups.get(b.beat_slug);
      if (list) list.push(b);
    }
    return groups;
  }, [data?.bounties]);

  const totalBounties = data?.bounties.length ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
        <FilterChip
          label="All"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {BEAT_SLUGS.map((slug) => (
          <FilterChip
            key={slug}
            label={BEAT_LABELS[slug]}
            active={filter === slug}
            onClick={() => setFilter(slug)}
          />
        ))}
      </div>

      {loading && (
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          Loading bounties from devnet…
        </p>
      )}

      {!loading && error && (
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.85rem',
            color: 'var(--warning)',
          }}
        >
          {error}
        </p>
      )}

      {!loading && data && !data.configured && (
        <div
          style={{
            border: '1px dashed var(--border)',
            backgroundColor: 'var(--surface)',
            padding: '1.25rem 1.5rem',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Solana program is not configured.</strong>
          <br />
          {data.reason ?? 'Set NEXT_PUBLIC_SOLANA_PROGRAM_ID in .env.local after deploying the lantern_bounty Anchor program to devnet.'}
        </div>
      )}

      {!loading && data?.configured && totalBounties === 0 && (
        <div
          style={{
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            padding: '1.25rem 1.5rem',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          No active bounties for this beat. Journalists fund pools from their dashboard.
        </div>
      )}

      {!loading && data?.configured && totalBounties > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Array.from(groupedByBeat.entries())
            .filter(([, list]) => list.length > 0)
            .map(([slug, list]) => (
              <section key={slug}>
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.25rem',
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {BEAT_LABELS[slug]}
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {list.map((b) => (
                    <BountyCard key={b.pda} bounty={b} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? 'var(--accent)' : 'transparent',
        color: active ? '#0a0a0a' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        padding: '0.4rem 0.75rem',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.72rem',
        letterSpacing: '0.05em',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
