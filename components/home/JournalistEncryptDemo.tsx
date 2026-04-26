'use client';

import { useEffect, useRef, useState } from 'react';

const PHRASES = [
  'Internal memo: Q3 budget overrun was hidden from the board.',
  'Confidential: regulator findings buried in subsidiary filings.',
  'Source notes — unsafe working conditions at the Rotterdam site.',
  'Tip: contractor was paid via offshore shell to influence permit.',
];

const CIPHER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function rand(len: number) {
  let out = '';
  for (let i = 0; i < len; i++) out += CIPHER[Math.floor(Math.random() * CIPHER.length)];
  return out;
}

type Phase = 'plain' | 'sealing' | 'sealed' | 'opening';

export default function JournalistEncryptDemo() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('plain');
  const [display, setDisplay] = useState(PHRASES[0]);
  const tickRef = useRef<number | null>(null);

  // Phase progression — readable → sealing → sealed → opening → next phrase
  useEffect(() => {
    const phrase = PHRASES[idx];
    setDisplay(phrase);
    setPhase('plain');

    const t1 = window.setTimeout(() => setPhase('sealing'), 1600);
    return () => window.clearTimeout(t1);
  }, [idx]);

  // Sealing: progressively scramble characters
  useEffect(() => {
    if (phase !== 'sealing') return;
    const phrase = PHRASES[idx];
    const STEPS = 22;
    let step = 0;
    tickRef.current = window.setInterval(() => {
      step++;
      const p = step / STEPS;
      let out = '';
      for (let i = 0; i < phrase.length; i++) {
        const ch = phrase[i];
        if (ch === ' ' || ch === '\n') {
          out += ch;
        } else if (Math.random() < p * 1.05) {
          out += CIPHER[Math.floor(Math.random() * CIPHER.length)];
        } else {
          out += ch;
        }
      }
      setDisplay(out);
      if (step >= STEPS) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        setPhase('sealed');
      }
    }, 60);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase, idx]);

  // Sealed: keep churning ciphertext, then begin opening
  useEffect(() => {
    if (phase !== 'sealed') return;
    const phrase = PHRASES[idx];
    const churn = window.setInterval(() => {
      // Keep spaces in the same positions for visual rhythm
      let out = '';
      for (let i = 0; i < phrase.length; i++) {
        out += phrase[i] === ' ' ? ' ' : CIPHER[Math.floor(Math.random() * CIPHER.length)];
      }
      setDisplay(out);
    }, 280);
    const tHold = window.setTimeout(() => {
      window.clearInterval(churn);
      setPhase('opening');
    }, 1900);
    return () => {
      window.clearInterval(churn);
      window.clearTimeout(tHold);
    };
  }, [phase, idx]);

  // Opening: progressively un-scramble back to readable
  useEffect(() => {
    if (phase !== 'opening') return;
    const phrase = PHRASES[idx];
    const STEPS = 18;
    let step = 0;
    tickRef.current = window.setInterval(() => {
      step++;
      const p = step / STEPS;
      let out = '';
      for (let i = 0; i < phrase.length; i++) {
        const ch = phrase[i];
        if (ch === ' ') {
          out += ' ';
        } else if (Math.random() < p) {
          out += ch;
        } else {
          out += CIPHER[Math.floor(Math.random() * CIPHER.length)];
        }
      }
      setDisplay(out);
      if (step >= STEPS) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        setDisplay(phrase);
        // Hold readable a beat, then advance to next phrase
        window.setTimeout(() => {
          setIdx((i) => (i + 1) % PHRASES.length);
        }, 1100);
      }
    }, 50);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase, idx]);

  const sealed = phase === 'sealing' || phase === 'sealed';
  const lockOpen = phase === 'plain' || phase === 'opening';

  return (
    <div className="je-demo" aria-hidden>
      <style>{styles}</style>

      <div className={`je-card ${sealed ? 'is-sealed' : ''}`}>
        <div className="je-meta">
          <span className="je-meta-label">Tip · routed to you</span>
          <span className={`je-pill ${sealed ? 'is-sealed' : ''}`}>
            {sealed ? 'Sealed' : 'Decrypted'}
          </span>
        </div>

        <pre className={`je-text ${sealed ? 'is-cipher' : ''}`}>
          {display}
        </pre>

        <div className="je-footer">
          <Padlock open={lockOpen} />
          <div className="je-footer-text">
            <span className="je-footer-line">
              {sealed ? 'box(curve25519 · xsalsa20 · poly1305)' : 'unlocked with your private key'}
            </span>
            <span className="je-footer-sub">
              {sealed ? 'no one in transit can read this' : 'cleartext only on your device'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Padlock({ open }: { open: boolean }) {
  return (
    <svg
      className={`je-lock ${open ? 'is-open' : ''}`}
      width="38"
      height="44"
      viewBox="0 0 38 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Shackle */}
      <path
        className="je-lock-shackle"
        d={open ? 'M10 18 V12 a9 9 0 0 1 18 0' : 'M10 18 V12 a9 9 0 0 1 18 0 V18'}
      />
      {/* Body */}
      <rect x="6" y="18" width="26" height="20" rx="3.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="28" r="2.4" fill="var(--surface)" />
      <line x1="19" y1="30" x2="19" y2="33.5" stroke="var(--surface)" />
    </svg>
  );
}

const styles = `
.je-demo {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.je-card {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 1.4rem 1.5rem 1.25rem;
  box-shadow: 0 18px 50px rgba(8, 13, 25, 0.08);
  transition: background-color 600ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 600ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 600ms cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
}

.je-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: 0 0 0 0 rgba(0, 113, 227, 0);
  transition: box-shadow 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed {
  background: linear-gradient(180deg, #1d2540 0%, #0d1224 100%);
  border-color: #2a3358;
  box-shadow: 0 24px 60px rgba(8, 13, 25, 0.32);
}

.je-card.is-sealed::before {
  box-shadow: 0 0 0 1px rgba(95, 228, 164, 0.18), 0 0 60px rgba(0, 113, 227, 0.18);
}

.je-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.9rem;
  font-family: 'SF Pro Text', -apple-system, sans-serif;
}

.je-meta-label {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-secondary);
  transition: color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed .je-meta-label {
  color: rgba(255, 255, 255, 0.55);
}

.je-pill {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(95, 228, 164, 0.16);
  color: #1d7a4d;
  border: 1px solid rgba(95, 228, 164, 0.4);
  transition: all 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-pill.is-sealed {
  background: rgba(0, 113, 227, 0.22);
  color: #cfe1ff;
  border-color: rgba(0, 113, 227, 0.55);
}

.je-text {
  margin: 0 0 1.15rem;
  font-family: 'IBM Plex Mono', 'Menlo', monospace;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 5.2em;
  transition: color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-text.is-cipher {
  color: #aac3ff;
  font-feature-settings: 'tnum' 1;
}

.je-footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--border);
  transition: border-color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed .je-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.je-lock {
  flex-shrink: 0;
  color: var(--text-primary);
  transition: color 500ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed .je-lock {
  color: var(--accent);
  transform: scale(1.04);
}

.je-lock-shackle {
  fill: none;
  transition: d 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-footer-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.je-footer-line {
  font-family: 'IBM Plex Mono', 'Menlo', monospace;
  font-size: 0.78rem;
  color: var(--text-primary);
  transition: color 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed .je-footer-line {
  color: #cfe1ff;
}

.je-footer-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  transition: color 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.je-card.is-sealed .je-footer-sub {
  color: rgba(255, 255, 255, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .je-card,
  .je-card::before,
  .je-meta-label,
  .je-text,
  .je-pill,
  .je-lock,
  .je-footer,
  .je-footer-line,
  .je-footer-sub,
  .je-lock-shackle {
    transition: none !important;
  }
}
`;
