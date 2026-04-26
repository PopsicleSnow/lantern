'use client';

import { useRef, useState } from 'react';
import { decodeBase64 } from 'tweetnacl-util';
import { encryptSecretKey } from '@/lib/crypto/passphrase';
import { saveKeystore, clearKeystore } from '@/lib/crypto/keystore';
import { publicKeyFromSecret } from '@/lib/crypto/keypair';

interface Props {
  journalist_id: string;
  expected_public_key?: string | null;
  onRestored: (params: { secret_key: Uint8Array; public_key: string }) => void;
}

export default function RestoreFromBackup({
  journalist_id,
  expected_public_key,
  onRestored,
}: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const valid = file && passphrase.length >= 8 && passphrase === confirm;

  const restore = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.secret_key_b64 || !parsed.public_key) {
        throw new Error('Backup file is missing keypair fields');
      }
      if (parsed.journalist_id && parsed.journalist_id !== journalist_id) {
        throw new Error(
          `Backup belongs to a different journalist (${parsed.journalist_id})`
        );
      }
      if (expected_public_key && parsed.public_key !== expected_public_key) {
        throw new Error('Backup public key does not match the server-published public key');
      }

      const secret_key = decodeBase64(parsed.secret_key_b64);
      const recovered_pub = publicKeyFromSecret(secret_key);
      if (recovered_pub !== parsed.public_key) {
        throw new Error('Corrupted backup: derived public key does not match');
      }

      const blob = await encryptSecretKey(secret_key, passphrase);
      await clearKeystore(journalist_id);
      await saveKeystore({
        journalist_id,
        public_key: parsed.public_key,
        encrypted_secret: blob,
        created_at: Date.now(),
      });

      onRestored({ secret_key, public_key: parsed.public_key });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', width: '100%' }}>
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
        RESTORE
      </div>
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.4rem',
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        Restore your keypair
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        Upload your <code>lantern-key-*.json</code> backup file and choose a new passphrase for this
        device.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: '1px dashed var(--border)',
          padding: '1.25rem',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '1rem',
          backgroundColor: 'var(--surface)',
        }}
      >
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.78rem',
            color: file ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {file ? file.name : 'Click to select backup file'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />
      </div>

      <input
        type="password"
        placeholder="New passphrase (min 8 chars)"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoComplete="new-password"
        style={{
          width: '100%',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.9rem',
          padding: '0.65rem 0.9rem',
          outline: 'none',
          marginBottom: '0.75rem',
        }}
      />
      <input
        type="password"
        placeholder="Confirm passphrase"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        style={{
          width: '100%',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.9rem',
          padding: '0.65rem 0.9rem',
          outline: 'none',
          marginBottom: '1rem',
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
        onClick={restore}
        disabled={!valid || busy}
        style={{
          width: '100%',
          backgroundColor: 'var(--accent)',
          color: '#0a0a0a',
          border: 'none',
          padding: '0.75rem',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600,
          fontSize: '0.9rem',
          cursor: !valid || busy ? 'not-allowed' : 'pointer',
          opacity: !valid || busy ? 0.5 : 1,
        }}
      >
        {busy ? 'Restoring...' : 'Restore keypair'}
      </button>
    </div>
  );
}
