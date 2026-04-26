'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { connectPhantom, getPhantom } from '@/lib/solana/phantom';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { BEAT_SLUGS, BEAT_LABELS, type BeatSlug } from '@/lib/solana/beats';

interface Props {
  journalist_id: string;
}

type Stage = 'idle' | 'connecting' | 'building' | 'signing' | 'sending' | 'done' | 'error';

export default function CreateBountyForm({ journalist_id }: Props) {
  const [walletPubkey, setWalletPubkey] = useState<string | null>(null);
  const [beat, setBeat] = useState<BeatSlug>('financial_fraud');
  const [amountSol, setAmountSol] = useState('0.01');
  const [maxClaims, setMaxClaims] = useState('5');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [txSig, setTxSig] = useState<string | null>(null);
  const [hasPhantom, setHasPhantom] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasPhantom(!!getPhantom());
  }, []);

  const connect = async () => {
    setError('');
    setStage('connecting');
    try {
      const pk = await connectPhantom();
      setWalletPubkey(pk.toBase58());
      setStage('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
      setStage('error');
    }
  };

  const submit = async () => {
    if (!walletPubkey) return;
    setError('');
    setTxSig(null);

    const amount = Number(amountSol);
    const claims = Number(maxClaims);
    if (!Number.isFinite(amount) || amount < 0.001) {
      setError('Amount must be at least 0.001 SOL');
      setStage('error');
      return;
    }
    if (!Number.isInteger(claims) || claims < 1) {
      setError('Max claims must be a positive integer');
      setStage('error');
      return;
    }

    setStage('building');
    try {
      const res = await fetch('/api/bounty/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          journalist_id,
          beat_slug: beat,
          amount_per_claim_sol: amount,
          max_claims: claims,
          journalist_solana_pubkey: walletPubkey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);

      setStage('signing');
      const provider = getPhantom();
      if (!provider) throw new Error('Phantom unavailable');

      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signed = await provider.signTransaction(tx);

      setStage('sending');
      const connection = getConnection();
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create bounty');
      setStage('error');
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        padding: '1.25rem 1.5rem',
      }}
    >
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          marginBottom: '0.25rem',
        }}
      >
        Fund a bounty
      </h2>
      <p
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
          lineHeight: 1.6,
        }}
      >
        Escrow SOL on Solana devnet to signal what beats you want tips on. Tippers
        whose tips you mark <code>closed</code> can claim the bounty to a one-time wallet.
      </p>

      {!hasPhantom && (
        <p
          style={{
            color: 'var(--warning)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            marginBottom: '0.75rem',
          }}
        >
          Phantom wallet not detected.{' '}
          <a
            href="https://phantom.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            Install Phantom
          </a>{' '}
          and reload to fund a bounty.
        </p>
      )}

      {!walletPubkey && hasPhantom && (
        <button
          onClick={connect}
          disabled={stage === 'connecting'}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#0a0a0a',
            border: 'none',
            padding: '0.6rem 1rem',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          {stage === 'connecting' ? 'Connecting…' : 'Connect Phantom'}
        </button>
      )}

      {walletPubkey && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
            }}
          >
            connected{' '}
            <span style={{ color: 'var(--text-primary)' }}>{walletPubkey}</span>
          </div>

          <Field label="Beat">
            <select
              value={beat}
              onChange={(e) => setBeat(e.target.value as BeatSlug)}
              style={inputStyle}
            >
              {BEAT_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {BEAT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Field label="Per-claim (SOL)">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amountSol}
                onChange={(e) => setAmountSol(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Max claims">
              <input
                type="number"
                min="1"
                value={maxClaims}
                onChange={(e) => setMaxClaims(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <p
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
            }}
          >
            Total escrow: ~{(Number(amountSol) || 0) * (Number(maxClaims) || 0)} SOL
          </p>

          <button
            onClick={submit}
            disabled={stage === 'building' || stage === 'signing' || stage === 'sending'}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#0a0a0a',
              border: 'none',
              padding: '0.65rem 1rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.78rem',
              letterSpacing: '0.05em',
              cursor:
                stage === 'building' || stage === 'signing' || stage === 'sending'
                  ? 'wait'
                  : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {stage === 'building' && 'Building tx…'}
            {stage === 'signing' && 'Sign in Phantom…'}
            {stage === 'sending' && 'Confirming…'}
            {(stage === 'idle' || stage === 'done' || stage === 'error') && 'Create bounty'}
          </button>

          {stage === 'done' && txSig && (
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.75rem',
                color: 'var(--success)',
              }}
            >
              Bounty live —{' '}
              <a
                href={explorerTxUrl(txSig)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                {txSig.slice(0, 16)}…
              </a>
            </p>
          )}
          {error && (
            <p
              style={{
                color: 'var(--warning)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.75rem',
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '0.85rem',
  padding: '0.5rem 0.65rem',
  outline: 'none',
};
