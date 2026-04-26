'use client';

import { useEffect, useState } from 'react';

type Field = { label: string; value: string };

const FIELDS: Field[] = [
  { label: 'Name', value: 'Margarethe van der Linden' },
  { label: 'Email', value: 'mvanderlinden@acme.example' },
  { label: 'IP address', value: '83.214.118.204' },
  { label: 'Device fingerprint', value: 'Macbook · Safari · Rotterdam' },
];

type Phase = 'show' | 'redacting' | 'redacted' | 'verifying' | 'sealed';

export default function SourceAnonymityDemo() {
  const [phase, setPhase] = useState<Phase>('show');
  const [redactedCount, setRedactedCount] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase('redacting'), 1400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (phase !== 'redacting') return;
    setRedactedCount(0);
    let i = 0;
    const tick = window.setInterval(() => {
      i++;
      setRedactedCount(i);
      if (i >= FIELDS.length) {
        window.clearInterval(tick);
        window.setTimeout(() => setPhase('redacted'), 380);
      }
    }, 380);
    return () => window.clearInterval(tick);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'redacted') return;
    const t = window.setTimeout(() => setPhase('verifying'), 700);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'verifying') return;
    const t = window.setTimeout(() => setPhase('sealed'), 1500);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Loop after sealed state
  useEffect(() => {
    if (phase !== 'sealed') return;
    const t = window.setTimeout(() => {
      setRedactedCount(0);
      setPhase('show');
    }, 2400);
    return () => window.clearTimeout(t);
  }, [phase]);

  const showVerified = phase === 'verifying' || phase === 'sealed';

  return (
    <div className="sa-demo" aria-hidden>
      <style>{styles}</style>

      <div className={`sa-pulse ${showVerified ? 'is-active' : ''}`} />
      <div className={`sa-pulse sa-pulse-2 ${showVerified ? 'is-active' : ''}`} />

      <div className="sa-card">
        <div className="sa-meta">
          <span className="sa-meta-label">Source identity</span>
          <span className={`sa-status ${showVerified ? 'is-verified' : ''}`}>
            {showVerified ? 'Anonymous' : 'Visible'}
          </span>
        </div>

        <ul className="sa-fields">
          {FIELDS.map((f, i) => {
            const redacted = i < redactedCount || phase === 'redacted' || showVerified;
            return (
              <li key={f.label} className="sa-field">
                <span className="sa-field-label">{f.label}</span>
                <span className={`sa-field-wrap ${redacted ? 'is-redacted' : ''}`}>
                  <span className="sa-field-value">{f.value}</span>
                  <span
                    className="sa-redaction"
                    style={{ width: redacted ? '100%' : '0%' }}
                  />
                </span>
              </li>
            );
          })}
        </ul>

        <div className={`sa-badge ${showVerified ? 'is-active' : ''}`}>
          <WorldIdGlyph />
          <div className="sa-badge-text">
            <span className="sa-badge-line">Verified human</span>
            <span className="sa-badge-sub">via World ID · zero-knowledge</span>
          </div>
          <span className={`sa-badge-check ${phase === 'sealed' ? 'is-on' : ''}`} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 12 10 18 20 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function WorldIdGlyph() {
  return (
    <span className="sa-glyph" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12 H21" />
        <path d="M12 3 c4 4 4 14 0 18" />
        <path d="M12 3 c-4 4 -4 14 0 18" />
      </svg>
    </span>
  );
}

const styles = `
.sa-demo {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.sa-pulse {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: 1px solid rgba(0, 113, 227, 0.18);
  pointer-events: none;
  opacity: 0;
  z-index: 0;
}

.sa-pulse.is-active {
  animation: saPulse 2.4s ease-out infinite;
}

.sa-pulse-2.is-active {
  animation-delay: 1.2s;
}

@keyframes saPulse {
  0% {
    transform: scale(0.7);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

.sa-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 1.4rem 1.5rem 1.3rem;
  box-shadow: 0 18px 50px rgba(8, 13, 25, 0.08);
}

.sa-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.sa-meta-label {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-secondary);
}

.sa-status {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(182, 68, 0, 0.14);
  color: #b64400;
  border: 1px solid rgba(182, 68, 0, 0.35);
  transition: all 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sa-status.is-verified {
  background: rgba(95, 228, 164, 0.18);
  color: #1d7a4d;
  border-color: rgba(95, 228, 164, 0.45);
}

.sa-fields {
  list-style: none;
  padding: 0;
  margin: 0 0 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sa-field {
  display: grid;
  grid-template-columns: 8.5rem 1fr;
  gap: 0.75rem;
  align-items: center;
  font-family: 'IBM Plex Mono', 'Menlo', monospace;
  font-size: 0.82rem;
}

.sa-field-label {
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}

.sa-field-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  display: flex;
  align-items: center;
  height: 1.6rem;
}

.sa-field-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  transition: color 400ms ease;
  padding: 0 0.25rem;
}

.sa-field-wrap.is-redacted .sa-field-value {
  color: rgba(0, 0, 0, 0);
}

.sa-redaction {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #15192c 0%, #0a0d18 100%);
  transition: width 320ms cubic-bezier(0.6, 0.02, 0.27, 1);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.sa-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  opacity: 0.4;
  transform: translateY(4px);
  transition: opacity 600ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 600ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 600ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sa-badge.is-active {
  opacity: 1;
  transform: translateY(0);
  border-color: rgba(0, 113, 227, 0.45);
  background: linear-gradient(180deg, rgba(0, 113, 227, 0.08) 0%, rgba(0, 113, 227, 0.02) 100%);
  box-shadow: 0 8px 22px rgba(0, 113, 227, 0.12);
}

.sa-glyph {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--text-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 500ms ease;
}

.sa-badge.is-active .sa-glyph {
  background: var(--accent);
}

.sa-badge-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.sa-badge-line {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text-primary);
}

.sa-badge-sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.sa-badge-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transform: scale(0.7);
  opacity: 0;
  transition: opacity 400ms ease, transform 400ms cubic-bezier(0.22, 1, 0.36, 1),
    color 400ms ease, border-color 400ms ease, background-color 400ms ease;
}

.sa-badge-check.is-on {
  opacity: 1;
  transform: scale(1);
  background: #5fe4a4;
  color: #0a3a22;
  border-color: #5fe4a4;
}

@media (prefers-reduced-motion: reduce) {
  .sa-pulse,
  .sa-pulse.is-active,
  .sa-card,
  .sa-status,
  .sa-redaction,
  .sa-badge,
  .sa-glyph,
  .sa-badge-check {
    transition: none !important;
    animation: none !important;
  }
}
`;
