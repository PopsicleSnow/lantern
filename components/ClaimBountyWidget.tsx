'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import WorldIDButton, { type WorldIDProof } from '@/components/WorldIDButton';
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
  // Optional: a caller (e.g. /submit confirmation right after a fresh verify)
  // can pre-supply a freshly-verified nullifier so the user doesn't have to
  // verify again seconds later. The /status flow always re-verifies.
  nullifierHash?: string;
}

type Stage =
  | 'probing'
  | 'idle'
  | 'verifying'
  | 'claiming'
  | 'success'
  | 'error'
  | 'unavailable';

export default function ClaimBountyWidget({ tipId, nullifierHash }: Props) {
  const [stage, setStage] = useState<Stage>('probing');
  const [availability, setAvailability] = useState<AvailableResponse | null>(null);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [result, setResult] = useState<{
    tx_sig: string;
    receipt_pda: string;
    amount_sol: number;
  } | null>(null);
  const [savedAck, setSavedAck] = useState(false);

  const claimedRef = useRef(false);

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

  const submitClaim = async (verifiedNullifier: string) => {
    if (claimedRef.current) return;
    claimedRef.current = true;

    let claimWallet = wallet;
    if (!claimWallet) {
      claimWallet = generateClaimWallet();
      setWallet(claimWallet);
    }

    setStage('claiming');
    setError('');
    try {
      const res = await fetch('/api/bounty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tip_id: tipId,
          nullifier_hash: verifiedNullifier,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
      setStage('error');
      claimedRef.current = false;
    }
  };

  // If a freshly-verified nullifier was passed in (only happens on the /submit
  // confirmation screen seconds after the user verified for the tip itself),
  // skip re-verification and claim immediately.
  useEffect(() => {
    if (
      nullifierHash &&
      stage === 'idle' &&
      availability?.available &&
      !claimedRef.current
    ) {
      void submitClaim(nullifierHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, stage, availability?.available]);

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
          <KeyExport wallet={wallet} saved={savedAck} onSavedChange={setSavedAck} />
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
      <h3 style={titleStyle}>
        Claim {availability?.amount_per_claim_sol?.toFixed(4)} SOL bounty
      </h3>
      <p style={hintStyle}>
        A journalist marked this tip <strong>closed</strong> and a Solana bounty
        is funded for the matching beat. Verify with World ID to prove
        you&apos;re the same human who submitted the tip — the resulting
        nullifier is deterministic and lets you claim from <em>any</em> browser
        or device. The platform&apos;s claim authority then sends the SOL to a
        one-time wallet generated locally. Your World ID and tip identity never
        reach the chain.
      </p>

      {stage === 'claiming' ? (
        <p style={{ ...hintStyle, color: 'var(--accent)', marginTop: '0.75rem' }}>
          Claim authority is signing and submitting the transaction…
        </p>
      ) : (
        <div style={{ marginTop: '0.75rem' }}>
          <WorldIDButton
            onSuccess={(proof: WorldIDProof) => {
              if (!proof.nullifier) {
                setError('World ID returned no nullifier');
                setStage('error');
                return;
              }
              void submitClaim(proof.nullifier);
            }}
            onError={(err) => {
              setError(err.message);
              setStage('error');
            }}
          />
        </div>
      )}

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
