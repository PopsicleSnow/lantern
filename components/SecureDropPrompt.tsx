'use client';

import { useState } from 'react';

interface SecureDropPromptProps {
  url: string;
}

export default function SecureDropPrompt({ url }: SecureDropPromptProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        border: '1px solid var(--accent-dim)',
        backgroundColor: 'var(--surface)',
        padding: '1.5rem',
        marginTop: '2rem',
      }}
    >
      <p
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}
      >
        SECURE DOCUMENT FOLLOW-UP
      </p>
      <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
        Need documents from this source?
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
        For document follow-up, invite your source to submit via SecureDrop.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.8rem',
            textDecoration: 'none',
            border: '1px solid var(--accent-dim)',
            padding: '0.5rem 1rem',
          }}
        >
          Open SecureDrop ↗
        </a>
        <button
          onClick={copyToClipboard}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.8rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy SecureDrop URL'}
        </button>
      </div>
    </div>
  );
}
