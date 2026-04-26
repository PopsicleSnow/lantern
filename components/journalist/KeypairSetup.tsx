'use client';

import { useState } from 'react';
import { encodeBase64 } from 'tweetnacl-util';
import { generateKeypair } from '@/lib/crypto/keypair';
import { encryptSecretKey } from '@/lib/crypto/passphrase';
import { saveKeystore } from '@/lib/crypto/keystore';
import { fingerprintPublicKey } from '@/lib/crypto/fingerprint';

interface Props {
  journalist_id: string;
  journalist_name: string;
  onComplete: (params: { secret_key: Uint8Array; public_key: string; fingerprint: string }) => void;
}

export default function KeypairSetup({ journalist_id, journalist_name, onComplete }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = passphrase.length >= 8 && passphrase === confirm && acknowledged;

  const generate = async () => {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const kp = generateKeypair();
      const blob = await encryptSecretKey(kp.secret_key, passphrase);
      const fingerprint = await fingerprintPublicKey(kp.public_key);

      await saveKeystore({
        journalist_id,
        public_key: kp.public_key,
        encrypted_secret: blob,
        created_at: Date.now(),
      });

      const upload = await fetch('/api/journalist/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({ journalist_id, public_key: kp.public_key }),
      });
      if (!upload.ok) {
        const data = await upload.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to upload public key');
      }

      const backup = {
        version: 1,
        journalist_id,
        journalist_name,
        public_key: kp.public_key,
        secret_key_b64: encodeBase64(kp.secret_key),
        fingerprint,
        created_at: new Date().toISOString(),
        warning:
          'This file contains your private key in plaintext. Store it somewhere safe (a hardware key, encrypted password manager, or air-gapped drive). Anyone with this file can read tips routed to you.',
      };
      const blob_url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = blob_url;
      a.download = `iceberg-key-${journalist_id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blob_url);

      onComplete({ secret_key: kp.secret_key, public_key: kp.public_key, fingerprint });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', width: '100%' }}>
      <div
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.7rem',
          color: 'var(--accent)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '1rem',
        }}
      >
        FIRST LOGIN
      </div>
      <h1
        style={{
          fontFamily: "'Libre Baskerville', serif",
          fontSize: '1.5rem',
          color: 'var(--text-primary)',
          marginBottom: '0.75rem',
        }}
      >
        Generate your keypair
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        Iceberg uses end-to-end encryption. Your private key stays on this device — encrypted with a
        passphrase you choose now. Tips are encrypted to your public key before they leave the
        source&apos;s browser. The server cannot read your tips.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.4rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Passphrase (min 8 chars)
        </label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="new-password"
          style={{
            width: '100%',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.9rem',
            padding: '0.65rem 0.9rem',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.4rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Confirm passphrase
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          style={{
            width: '100%',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.9rem',
            padding: '0.65rem 0.9rem',
            outline: 'none',
          }}
        />
        {confirm && passphrase !== confirm && (
          <p
            style={{
              color: 'var(--warning)',
              fontFamily: "'Source Code Pro', monospace",
              fontSize: '0.7rem',
              marginTop: '0.4rem',
            }}
          >
            Passphrases do not match
          </p>
        )}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          marginBottom: '1.5rem',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          style={{ marginTop: '0.2rem' }}
        />
        <span
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          I understand: if I forget this passphrase and lose my backup .json file, every tip routed to
          me becomes permanently unreadable. There is no recovery.
        </span>
      </label>

      {error && (
        <p
          style={{
            color: 'var(--warning)',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.78rem',
            marginBottom: '0.75rem',
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={generate}
        disabled={!valid || busy}
        style={{
          width: '100%',
          backgroundColor: 'var(--accent)',
          color: 'var(--bg)',
          border: 'none',
          padding: '0.9rem',
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 600,
          fontSize: '0.95rem',
          cursor: !valid || busy ? 'not-allowed' : 'pointer',
          opacity: !valid || busy ? 0.5 : 1,
        }}
      >
        {busy ? 'Generating...' : 'Generate keypair & download backup'}
      </button>

      <p
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          marginTop: '1rem',
          lineHeight: 1.5,
        }}
      >
        Fingerprint preview will be visible after generation. Compare it against the public{' '}
        <a href="/transparency" style={{ color: 'var(--accent)' }}>
          transparency page
        </a>{' '}
        to verify your key wasn&apos;t tampered with in transit.
      </p>
    </div>
  );
}
