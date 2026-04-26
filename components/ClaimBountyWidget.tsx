'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { generateClaimWallet } from '@/lib/solana/claim-wallet';
import { explorerTxUrl, explorerAddressUrl } from '@/lib/solana/connection';

interface AvailableResponse {
  available: boolean;
  reason?: string;
  beat_slug?: string;
  journalist_solana_pubkey?: string;
  amount_per_claim_sol?: number;
  amount_per_claim_lamports?: string;
  claims_remaining?: number;
}

interface Props {
  tipId: string;
  // Optional: caller can pre-supply the nullifier (e.g. from sessionStorage on /submit
  // confirmation screen). When omitted the widget reads sessionStorage itself.
  nullifierHash?: string;
}

type Stage = 'probing' | 'idle' | 'claiming' | 'success' | 'error' | 'unavailable';

export default function ClaimBountyWidget({ tipId, nullifierHash }: Props) {
  const [stage, setStage] = useState<Stage>('probing');
  const [availability, setAvailability] = useState<AvailableResponse | null>(null);
  const [error, setError] = useState('');
  const [nullifier, setNullifier] = useState<string>(nullifierHash ?? '');
  const [wallet, setWallet] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [result, setResult] = useState<{
    tx_sig: string;
    receipt_pda: string;
    amount_sol: number;
  } | null>(null);
  const [savedAck, setSavedAck] = useState(false);

  useEffect(() => {
    if (!nullifierHash && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`lantern.tip.${tipId}.nullifier`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setNullifier(stored);
    }
  }, [tipId, nullifierHash]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage('probing');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');
    fetch(`/api/bounty/available?tip_id=${tipId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!cancelled) {
          setAvailability(json);
          if (json.available) setStage('idle');
          else setStage('unavailable');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to probe bounty');
          setStage('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tipId]);

  const claim = async () => {
    if (!nullifier) {
      setError('No nullifier available. Bounties can only be claimed from the same browser session that submitted the tip.');
      setStage('error');
      return;
    }
    setError('');

    let claimWallet = wallet;
    if (!claimWallet) {
      claimWallet = generateClaimWallet();
      setWallet(claimWallet);
    }

    setStage('claiming');
    try {
      const res = await fetch('/api/bounty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tip_id: tipId,
          nullifier_hash: nullifier,
          recipient_wallet: claimWallet.publicKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Claim failed (${res.status})`);

      setResult({
        tx_sig: json.tx_sig,
        receipt_pda: json.receipt_pda,
        amount_sol: json.amount_sol,
      });
      setStage('success');
      try {
        sessionStorage.removeItem(`lantern.tip.${tipId}.nullifier`);
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
      setStage('error');
    }
  };

  if (stage === 'probing') {
    return (
      <Wrapper>
        <p style={hintStyle}>Checking for an active bounty…</p>
      </Wrapper>
    );
  }

  if (stage === 'unavailable') {
    if (availability?.reason === 'Bounty already claimed') {
      return (
        <Wrapper>
          <h3 style={titleStyle}>Bounty already claimed</h3>
          <p style={hintStyle}>This tip&apos;s bounty has already been paid out.</p>
        </Wrapper>
      );
    }
    return null;
  }

  if (stage === 'success' && result) {
    return (
      <Wrapper success>
        <h3 style={{ ...titleStyle, color: 'var(--success)' }}>Bounty paid</h3>
        <p style={hintStyle}>
          {result.amount_sol.toFixed(4)} SOL was sent to your one-time wallet.
        </p>

        {wallet && (
          <KeyExport
            wallet={wallet}
            saved={savedAck}
            onSavedChange={setSavedAck}
          />
        )}

        <p style={{ ...hintStyle, marginTop: '0.75rem' }}>
          Transaction:{' '}
          <a
            href={explorerTxUrl(result.tx_sig)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            {result.tx_sig.slice(0, 16)}…
          </a>
        </p>
        <p style={hintStyle}>
          Receipt PDA:{' '}
          <a
            href={explorerAddressUrl(result.receipt_pda)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            {result.receipt_pda.slice(0, 16)}…
          </a>
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <h3 style={titleStyle}>Claim {availability?.amount_per_claim_sol?.toFixed(4)} SOL bounty</h3>
      <p style={hintStyle}>
        A journalist marked this tip <strong>closed</strong> and a Solana bounty
        is funded for the matching beat. Click below to generate a one-time
        recipient wallet and have the platform&apos;s claim authority send the
        SOL on your behalf. Your identity never reaches the chain.
      </p>

      {nullifier ? (
        <p style={hintStyle}>
          <strong>Nullifier ready</strong> (stored in this browser&apos;s session).
        </p>
      ) : (
        <p style={{ ...hintStyle, color: 'var(--warning)' }}>
          No nullifier in session. Bounties can only be claimed from the same
          browser session that submitted the tip.
        </p>
      )}

      <button
        disabled={!nullifier || stage === 'claiming'}
        onClick={claim}
        style={{
          backgroundColor: nullifier ? 'var(--accent)' : 'var(--border)',
          color: '#0a0a0a',
          border: 'none',
          padding: '0.7rem 1.1rem',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.78rem',
          letterSpacing: '0.05em',
          cursor: nullifier && stage !== 'claiming' ? 'pointer' : 'not-allowed',
          marginTop: '0.5rem',
        }}
      >
        {stage === 'claiming' ? 'Claiming…' : 'Claim bounty'}
      </button>

      {error && (
        <p style={{ ...hintStyle, color: 'var(--warning)', marginTop: '0.75rem' }}>
          {error}
        </p>
      )}

      <p style={{ ...hintStyle, fontSize: '0.65rem', marginTop: '1rem' }}>
        Want to learn more about the bounty mechanism?{' '}
        <Link href="/bounties" style={{ color: 'var(--accent)' }}>
          Browse the bounty board.
        </Link>
      </p>
    </Wrapper>
  );
}

function KeyExport({
  wallet,
  saved,
  onSavedChange,
}: {
  wallet: { publicKey: string; secretKey: string };
  saved: boolean;
  onSavedChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        backgroundColor: 'var(--bg)',
        padding: '0.85rem 1rem',
        marginTop: '0.75rem',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        wordBreak: 'break-all',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: 'var(--text-primary)' }}>One-time wallet</strong>
      <div style={{ marginTop: '0.4rem' }}>
        <span style={{ opacity: 0.7 }}>Public key:</span>
        <br />
        {wallet.publicKey}
      </div>
      <details style={{ marginTop: '0.5rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>
          Reveal secret key (Base64)
        </summary>
        <div style={{ marginTop: '0.4rem' }}>{wallet.secretKey}</div>
      </details>
      <p style={{ marginTop: '0.5rem' }}>
        Import the secret key into Phantom or another Solana wallet to sweep the
        funds. Once you close this page the secret key is gone forever — Lantern
        does not store it.
      </p>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginTop: '0.4rem',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => onSavedChange(e.target.checked)}
        />
        <span>I have saved my secret key.</span>
      </label>
    </div>
  );
}

function Wrapper({ children, success }: { children: React.ReactNode; success?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${success ? 'var(--success)' : 'var(--accent)'}`,
        backgroundColor: 'var(--surface)',
        padding: '1.25rem 1.5rem',
        marginTop: '2rem',
      }}
    >
      {children}
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: '1.05rem',
  color: 'var(--text-primary)',
  marginBottom: '0.4rem',
};

const hintStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};
