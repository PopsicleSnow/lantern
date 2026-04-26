'use client';

import { useState } from 'react';
import { decryptSecretKey } from '@/lib/crypto/passphrase';
import { loadKeystore } from '@/lib/crypto/keystore';

interface Props {
  journalist_id: string;
  fingerprint?: string | null;
  onUnlocked: (params: { secret_key: Uint8Array; public_key: string }) => void;
  onWipe: () => void;
}

export default function PassphraseUnlock({
  journalist_id,
  fingerprint,
  onUnlocked,
  onWipe,
}: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      const entry = await loadKeystore(journalist_id);
      if (!entry) {
        onWipe();
        return;
      }
      const secret_key = await decryptSecretKey(entry.encrypted_secret, passphrase);
      onUnlocked({ secret_key, public_key: entry.public_key });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', width: '100%' }}>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--accent)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '1rem',
        }}
      >
        UNLOCK
      </div>
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.4rem',
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        Enter your passphrase
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        Unlocks your encryption key for this session. The decrypted key is held in memory only.
      </p>

      {fingerprint && (
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
          }}
        >
          Fingerprint: <span style={{ color: 'var(--accent)' }}>{fingerprint.slice(0, 16)}</span>
        </p>
      )}

      <input
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && passphrase && unlock()}
        autoFocus
        style={{
          width: '100%',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.9rem',
          padding: '0.65rem 0.9rem',
          marginBottom: '1rem',
          outline: 'none',
        }}
      />

      {error && (
        <p
          style={{
            color: 'var(--warning)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            marginBottom: '0.75rem',
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={unlock}
        disabled={!passphrase || busy}
        style={{
          width: '100%',
          backgroundColor: 'var(--accent)',
          color: '#0a0a0a',
          border: 'none',
          padding: '0.75rem',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600,
          fontSize: '0.9rem',
          cursor: !passphrase || busy ? 'not-allowed' : 'pointer',
          opacity: !passphrase || busy ? 0.5 : 1,
        }}
      >
        {busy ? 'Unlocking...' : 'Unlock'}
      </button>

      <button
        onClick={onWipe}
        style={{
          marginTop: '1rem',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          cursor: 'pointer',
          textDecoration: 'underline',
          width: '100%',
          textAlign: 'center',
        }}
      >
        Forgot passphrase? Restore from backup file
      </button>
    </div>
  );
}
