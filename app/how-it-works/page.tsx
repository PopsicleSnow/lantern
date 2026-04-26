'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type StepId = 0 | 1 | 2 | 3;

type Step = {
  id: StepId;
  label: string;
  title: string;
  body: string;
  caption: string;
};

const STEPS: Step[] = [
  {
    id: 0,
    label: 'Step 01',
    title: 'Write & Verify',
    body:
      'Compose your tip in the browser. Optionally prove you are a real human with World ID — the platform never learns who you are, only that you are not a bot.',
    caption: 'Source · raw document',
  },
  {
    id: 1,
    label: 'Step 02',
    title: 'Local Processing',
    body:
      'On-device edge AI classifies the tip, then TweetNaCl seals the cleartext to the recipient public keys. The plaintext never leaves your machine.',
    caption: 'Sealed · on your device',
  },
  {
    id: 2,
    label: 'Step 03',
    title: 'Fetch.ai Routing',
    body:
      'A Fetch.ai autonomous agent reviews only the metadata — category, urgency, structural quality — then routes the sealed envelope using ASI:One.',
    caption: 'In transit · zero plaintext',
  },
  {
    id: 3,
    label: 'Step 04',
    title: 'Secure Delivery',
    body:
      'The intended journalist unlocks the envelope in their browser with the private key only they hold. You can verify delivery on /status — without ever learning who read it.',
    caption: 'Delivered · decrypted',
  },
];

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState<StepId>(0);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    // Track which step sections currently overlap the trigger band so we can
    // pick the one whose center is closest to the viewport center. This avoids
    // flicker when two sections briefly overlap during fast scrolls.
    const visible = new Map<StepId, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute('data-step')) as StepId;
          if (entry.isIntersecting) visible.set(idx, entry);
          else visible.delete(idx);
        }

        if (visible.size === 0) return;

        const viewportCenter = window.innerHeight / 2;
        let bestIdx: StepId = 0;
        let bestDist = Infinity;
        visible.forEach((entry, idx) => {
          const r = entry.boundingClientRect;
          const dist = Math.abs(r.top + r.height / 2 - viewportCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });
        setActiveStep(bestIdx);
      },
      {
        // Active band = central 20% of the viewport.
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0,
      },
    );

    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
      }}
    >
      <style>{styles}</style>

      <section className="hiw-hero">
        <div className="hiw-hero-inner">
          <span className="hiw-eyebrow">How It Works</span>
          <h1 className="hiw-h1">
            Four steps. <br />
            <span style={{ color: 'var(--text-secondary)' }}>Zero plaintext.</span>
          </h1>
          <p className="hiw-sub">
            Scroll to follow a tip from your keyboard to a journalist&apos;s inbox — sealed,
            routed, and read without anyone ever reading it in transit.
          </p>
        </div>
        <div className="hiw-scroll-cue" aria-hidden>
          <span>Scroll</span>
          <span className="hiw-scroll-line" />
        </div>
      </section>

      <div className="hiw-grid">
        <aside className="hiw-stage-wrap" aria-hidden>
          <Stage activeStep={activeStep} />
          <ProgressDots activeStep={activeStep} />
        </aside>

        <section className="hiw-steps">
          {/* Vertical rail tying all four steps together visually. */}
          <div className="hiw-rail" aria-hidden>
            <div
              className="hiw-rail-fill"
              style={{
                transform: `scaleY(${(activeStep + 1) / STEPS.length})`,
                transition: `transform 700ms ${EASE}`,
              }}
            />
          </div>

          {STEPS.map((step, i) => (
            <article
              key={step.id}
              data-step={i}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className={`hiw-step ${activeStep === step.id ? 'is-active' : ''} ${
                i < activeStep ? 'is-passed' : ''
              }`}
            >
              <span className="hiw-step-marker" aria-hidden />
              <span className="hiw-step-label">{step.label}</span>
              <h2 className="hiw-step-title">{step.title}</h2>
              <p className="hiw-step-body">{step.body}</p>
              <span className="hiw-step-caption">{step.caption}</span>
            </article>
          ))}
        </section>
      </div>

      <section className="hiw-outro">
        <h2 className="hiw-outro-title">Ready to send a tip?</h2>
        <p className="hiw-outro-sub">
          The cleartext never leaves your browser. The platform itself cannot read your message.
        </p>
        <div className="hiw-outro-actions">
          <Link href="/submit" className="hiw-cta-primary">
            Submit a Tip
          </Link>
          <Link href="/transparency" className="hiw-cta-secondary">
            Verify Journalist Keys
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ============================================================
 * Stage — sticky graphic that morphs based on activeStep.
 * ============================================================ */

function Stage({ activeStep }: { activeStep: StepId }) {
  // Anchor points (percentage from stage center, x).
  // -32% source, 0% agent, +32% journalist.
  const anchors = useMemo(
    () => ({
      source: -32,
      agent: 0,
      journalist: 32,
    }),
    [],
  );

  // Document position by step.
  const docX =
    activeStep === 0 || activeStep === 1
      ? anchors.source
      : activeStep === 2
      ? anchors.agent
      : anchors.journalist;

  const docScale = activeStep === 0 ? 1 : 0.72;

  // Three-state document visual:
  //   raw       → blank paper (step 0, before encryption)
  //   sealed    → dark navy ciphertext (steps 1–2)
  //   decrypted → readable paper again, with a verified accent (step 3)
  const docState: 'raw' | 'sealed' | 'decrypted' =
    activeStep === 0 ? 'raw' : activeStep <= 2 ? 'sealed' : 'decrypted';

  // Padlock follows the document once it appears (steps 1+).
  const lockVisible = activeStep >= 1;
  const lockX = docX;
  const lockOpen = activeStep === 3;

  // World ID badge only on step 0.
  const worldIdVisible = activeStep === 0;

  // Zone activations.
  const sourceActive = activeStep <= 1;
  const agentActive = activeStep === 2;
  const journalistActive = activeStep === 3;

  // Trail progress (0 → 1 across the journey).
  const trail =
    activeStep === 0 ? 0 : activeStep === 1 ? 0.18 : activeStep === 2 ? 0.55 : 1;

  // Padlock vertical state: hidden above on step 0, snapped onto doc on
  // steps 1–2, lifted off the doc on step 3 (the unlock moment).
  const lockTranslateY = !lockVisible ? -110 : lockOpen ? -68 : -2;

  return (
    <div className="hiw-stage">
      {/* Connecting trail */}
      <div className="hiw-trail">
        <div
          className="hiw-trail-fill"
          style={{
            transform: `scaleX(${trail})`,
            transition: `transform 900ms ${EASE}`,
          }}
        />
      </div>

      {/* Zone anchors */}
      <Zone
        x={anchors.source}
        label="Source"
        sub="Your browser"
        active={sourceActive}
        icon={<PencilIcon />}
      />
      <Zone
        x={anchors.agent}
        label="Agent"
        sub="Fetch.ai · ASI:One"
        active={agentActive}
        icon={<NodeIcon pulse={agentActive} />}
      />
      <Zone
        x={anchors.journalist}
        label="Journalist"
        sub="Decrypted in-browser"
        active={journalistActive}
        icon={<InboxIcon open={journalistActive} />}
      />

      {/* The document — outer track is stage-sized so % translateX is
          stage-relative; inner piece self-centers and scales. */}
      <div
        className="hiw-stage-track"
        style={{
          transform: `translateX(${docX}%)`,
          transition: `transform 900ms ${EASE}`,
        }}
      >
        <div
          className="hiw-stage-piece"
          style={{
            transform: `translate(-50%, -50%) scale(${docScale})`,
            transition: `transform 900ms ${EASE}`,
          }}
        >
          <Document state={docState} />

          {/* World ID badge attached to doc on step 0 */}
          <div
            className="hiw-world-id"
            style={{
              opacity: worldIdVisible ? 1 : 0,
              transform: `translate(60%, -60%) scale(${worldIdVisible ? 1 : 0.6})`,
              transition: `opacity 500ms ${EASE}, transform 700ms ${EASE}`,
            }}
          >
            <WorldIdBadge />
          </div>
        </div>
      </div>

      {/* The padlock — same track-wrapper trick. */}
      <div
        className="hiw-stage-track hiw-lock-track"
        style={{
          transform: `translateX(${lockX}%)`,
          transition: `transform 900ms ${EASE}`,
        }}
      >
        <div
          className="hiw-stage-piece hiw-lock"
          style={{
            transform: `translate(-50%, -50%) translateY(${lockTranslateY}%) scale(${
              lockVisible ? (lockOpen ? 0.92 : 1) : 0.6
            })`,
            opacity: lockVisible ? 1 : 0,
            transition: `transform 900ms ${EASE}, opacity 500ms ${EASE}`,
          }}
        >
          <Padlock open={lockOpen} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Stage primitives
 * ============================================================ */

function Zone({
  x,
  label,
  sub,
  active,
  icon,
}: {
  x: number;
  label: string;
  sub: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`hiw-zone ${active ? 'is-active' : ''}`}
      style={{
        // `left` percent is parent-relative, so zones spread across the stage
        // instead of collapsing onto each other (translateX % is self-relative).
        left: `${50 + x}%`,
      }}
    >
      <div className="hiw-zone-icon">{icon}</div>
      <div className="hiw-zone-label">{label}</div>
      <div className="hiw-zone-sub">{sub}</div>
    </div>
  );
}

type DocState = 'raw' | 'sealed' | 'decrypted';

function Document({ state }: { state: DocState }) {
  const sealed = state === 'sealed';
  const decrypted = state === 'decrypted';

  // Page fill: sealed → dark navy gradient, otherwise light paper.
  const fillId = sealed ? 'url(#doc-sealed)' : 'url(#doc-paper)';
  // Stroke + corner pick up the green accent on the decrypted state so the
  // "this has been opened" moment reads instantly.
  const strokeColor = sealed ? '#0c1224' : decrypted ? '#5fe4a4' : '#d2d2d7';
  const cornerFill = sealed ? '#2a3358' : decrypted ? '#d6f5e6' : '#e6eaf5';
  const lineFill = sealed ? '#3b4c7c' : decrypted ? '#3a8b62' : '#c8ccd6';
  const lineOpacity = sealed ? 0.55 : 1;

  return (
    <svg
      width="120"
      height="150"
      viewBox="0 0 120 150"
      style={{
        display: 'block',
        filter: sealed
          ? 'drop-shadow(0 14px 30px rgba(8, 13, 25, 0.18))'
          : decrypted
          ? 'drop-shadow(0 12px 28px rgba(95, 228, 164, 0.32))'
          : 'drop-shadow(0 12px 28px rgba(0, 113, 227, 0.18))',
        transition: `filter 600ms ${EASE}`,
      }}
    >
      <defs>
        <linearGradient id="doc-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f4f6fb" />
        </linearGradient>
        <linearGradient id="doc-sealed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2540" />
          <stop offset="100%" stopColor="#0d1224" />
        </linearGradient>
      </defs>

      {/* Page */}
      <rect
        x="6"
        y="6"
        width="108"
        height="138"
        rx="10"
        fill={fillId}
        stroke={strokeColor}
        strokeWidth={decrypted ? 1.5 : 1}
        style={{ transition: `fill 700ms ${EASE}, stroke 700ms ${EASE}` }}
      />

      {/* Folded corner */}
      <path
        d="M94 6 L114 26 L94 26 Z"
        fill={cornerFill}
        style={{ transition: `fill 700ms ${EASE}` }}
      />

      {/* Lines */}
      {[
        [22, 60],
        [32, 80],
        [42, 50],
        [52, 70],
        [62, 40],
        [72, 65],
        [82, 55],
      ].map(([y, w], i) => (
        <rect
          key={i}
          x="20"
          y={y}
          width={w}
          height="3"
          rx="1.5"
          fill={lineFill}
          opacity={lineOpacity}
          style={{
            transition: `opacity 600ms ${EASE} ${i * 30}ms, fill 600ms ${EASE}`,
          }}
        />
      ))}

      {/* Verified / opened indicator (visible once sealed or decrypted) */}
      <g
        opacity={state === 'raw' ? 0 : 1}
        style={{ transition: `opacity 500ms ${EASE} 200ms` }}
      >
        <circle cx="60" cy="120" r="6" fill={decrypted ? '#5fe4a4' : '#5fe4a4'} />
        {decrypted && (
          <path
            d="M57 120 L59.5 122.5 L63 118.5"
            stroke="#0d1224"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  );
}

function Padlock({ open }: { open: boolean }) {
  return (
    <svg
      width="64"
      height="80"
      viewBox="0 0 64 80"
      style={{
        display: 'block',
        filter: 'drop-shadow(0 8px 18px rgba(8, 13, 25, 0.25))',
      }}
    >
      <defs>
        <linearGradient id="lock-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d1d1f" />
          <stop offset="100%" stopColor="#0a0a0c" />
        </linearGradient>
      </defs>

      {/* Shackle (rotates open) */}
      <g
        style={{
          transformOrigin: '46px 30px',
          transform: open ? 'rotate(-32deg) translate(-2px, -3px)' : 'rotate(0) translate(0, 0)',
          transition: `transform 700ms ${EASE}`,
        }}
      >
        <path
          d="M16 36 V22 a16 16 0 0 1 32 0 V36"
          stroke="#1d1d1f"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Body */}
      <rect x="6" y="34" width="52" height="42" rx="8" fill="url(#lock-body)" />

      {/* Keyhole */}
      <circle cx="32" cy="50" r="4" fill={open ? '#5fe4a4' : '#ffffff'} style={{ transition: `fill 600ms ${EASE}` }} />
      <rect x="30" y="50" width="4" height="12" rx="1.5" fill={open ? '#5fe4a4' : '#ffffff'} style={{ transition: `fill 600ms ${EASE}` }} />
    </svg>
  );
}

function WorldIdBadge() {
  return (
    <div className="hiw-world-id-pill">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M2 12 H22" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2 a14 14 0 0 1 0 20 a14 14 0 0 1 0 -20" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <span>World ID</span>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20 L4 16 L16 4 L20 8 L8 20 Z" strokeLinejoin="round" />
      <path d="M14 6 L18 10" />
    </svg>
  );
}

function NodeIcon({ pulse }: { pulse: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="7" opacity={pulse ? 0.5 : 0.25} />
      <circle cx="12" cy="12" r="11" opacity={pulse ? 0.25 : 0.1} />
    </svg>
  );
}

function InboxIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 13 L7 6 H17 L21 13 V19 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 Z" strokeLinejoin="round" />
      <path d="M3 13 H8 L10 15 H14 L16 13 H21" strokeLinejoin="round" />
      <path
        d="M9 4 L12 1 L15 4"
        opacity={open ? 1 : 0}
        style={{ transition: `opacity 500ms ${EASE}` }}
      />
    </svg>
  );
}

/* ============================================================
 * Progress dots
 * ============================================================ */

function ProgressDots({ activeStep }: { activeStep: StepId }) {
  return (
    <div className="hiw-dots" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s.id}
          className={`hiw-dot ${i === activeStep ? 'is-active' : ''} ${
            i < activeStep ? 'is-passed' : ''
          }`}
        />
      ))}
    </div>
  );
}

/* ============================================================
 * Styles
 * ============================================================ */

const styles = `
.hiw-hero {
  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(3rem, 8vw, 6rem) 1.5rem 4rem;
  text-align: center;
  position: relative;
}
.hiw-hero-inner {
  max-width: 720px;
  margin: 0 auto;
}
.hiw-eyebrow {
  display: inline-block;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 1.25rem;
}
.hiw-h1 {
  font-size: clamp(2.5rem, 6.5vw, 4.5rem);
  line-height: 1.05;
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}
.hiw-sub {
  margin: 1.5rem auto 0;
  color: var(--text-secondary);
  font-size: 1.125rem;
  line-height: 1.6;
  max-width: 56ch;
}
.hiw-scroll-cue {
  margin-top: 3rem;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.hiw-scroll-line {
  width: 1px;
  height: 36px;
  background: linear-gradient(to bottom, var(--text-secondary), transparent);
  animation: hiw-scroll-pulse 2.4s ease-in-out infinite;
}

@keyframes hiw-scroll-pulse {
  0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
  50% { opacity: 1; transform: scaleY(1); }
}

.hiw-grid {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: grid;
  /* Bias toward the text column for breathing room; smaller gap so the two
     halves read as one continuous experience instead of two stuck-together
     panels. */
  grid-template-columns: minmax(280px, 0.85fr) 1fr;
  gap: clamp(1rem, 3vw, 2.25rem);
  align-items: start;
}

.hiw-stage-wrap {
  position: sticky;
  top: 110px;
  height: calc(100vh - 140px);
  max-height: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.hiw-stage {
  position: relative;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 1 / 1;
}

.hiw-trail {
  position: absolute;
  top: 50%;
  left: 18%;
  right: 18%;
  height: 1px;
  background: rgba(13, 18, 36, 0.1);
  transform: translateY(-50%);
  pointer-events: none;
}
.hiw-trail-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--accent), #5fe4a4);
  transform-origin: left center;
  transform: scaleX(0);
}

/* Track = full-stage-sized invisible wrapper. Lets us use stage-relative
   percentages on its transform, since the wrapper's width = stage width. */
.hiw-stage-track {
  position: absolute;
  inset: 0;
  pointer-events: none;
  will-change: transform;
  z-index: 2;
}
.hiw-lock-track { z-index: 3; }

.hiw-stage-piece {
  position: absolute;
  top: 50%;
  left: 50%;
  will-change: transform, opacity;
}

.hiw-world-id {
  position: absolute;
  top: 0;
  right: 0;
  transform-origin: center;
  pointer-events: none;
}
.hiw-world-id-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  background: var(--text-primary);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 999px;
  letter-spacing: 0.04em;
  box-shadow: 0 6px 18px rgba(0,0,0,0.18);
}

.hiw-zone {
  position: absolute;
  top: 50%;
  /* Pushed below the trail line + below the traveling document so the icon
     and label stack live in their own lane. */
  transform: translate(-50%, 78px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  transition: opacity 500ms ${EASE};
  z-index: 1;
  pointer-events: none;
  opacity: 0.55;
  text-align: center;
}
.hiw-zone.is-active { opacity: 1; }

.hiw-zone-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  transition: transform 500ms ${EASE}, box-shadow 500ms ${EASE}, border-color 500ms ${EASE};
}
.hiw-zone.is-active .hiw-zone-icon {
  transform: scale(1.08);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(0,113,227,0.12), 0 8px 22px rgba(0,113,227,0.18);
  color: var(--accent);
}

.hiw-zone-label {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  line-height: 1.2;
}
.hiw-zone-sub {
  font-size: 0.68rem;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  white-space: nowrap;
  line-height: 1.2;
}

.hiw-dots {
  display: flex;
  gap: 0.5rem;
}
.hiw-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  transition: background-color 400ms ${EASE}, width 400ms ${EASE};
}
.hiw-dot.is-passed { background: var(--accent-dim); }
.hiw-dot.is-active {
  background: var(--accent);
  width: 22px;
}

.hiw-steps {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-top: 18vh;
  padding-bottom: 18vh;
  /* Leave room on the left for the connecting rail and step markers. */
  padding-left: 2.25rem;
}

/* The vertical rail running through all four steps; visually ties the
   graphic side and the text side into a single timeline. */
.hiw-rail {
  position: absolute;
  top: 18vh;
  bottom: 18vh;
  left: 7px;
  width: 2px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.hiw-rail-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--accent), #5fe4a4);
  transform-origin: top center;
  transform: scaleY(0);
}

.hiw-step {
  position: relative;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem 0;
  transition: opacity 600ms ${EASE}, transform 600ms ${EASE};
  opacity: 0.45;
  transform: translateY(8px);
}
.hiw-step.is-active {
  opacity: 1;
  transform: translateY(0);
}

/* Marker dot sitting on the rail next to each step label. */
.hiw-step-marker {
  position: absolute;
  left: -2.25rem;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--border);
  transform: translate(0, -50%);
  transition: background-color 500ms ${EASE}, border-color 500ms ${EASE},
    box-shadow 500ms ${EASE}, transform 500ms ${EASE};
}
.hiw-step.is-passed .hiw-step-marker {
  background: var(--accent);
  border-color: var(--accent);
}
.hiw-step.is-active .hiw-step-marker {
  background: var(--accent);
  border-color: var(--accent);
  transform: translate(0, -50%) scale(1.1);
  box-shadow: 0 0 0 6px rgba(0, 113, 227, 0.12);
}

.hiw-step-label {
  font-size: 0.74rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.85rem;
}
.hiw-step-title {
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1;
  margin: 0 0 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
.hiw-step-body {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.65;
  color: var(--text-secondary);
  max-width: 48ch;
}
.hiw-step-caption {
  margin-top: 1.5rem;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.hiw-step-caption::before {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--accent);
}

.hiw-outro {
  max-width: 720px;
  margin: clamp(4rem, 10vw, 8rem) auto 6rem;
  padding: clamp(3rem, 6vw, 4.5rem) 2rem;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f6ff 100%);
  box-shadow: 0 20px 60px rgba(8, 13, 25, 0.06);
}
.hiw-outro-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  margin: 0 0 0.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.hiw-outro-sub {
  margin: 0 auto 2rem;
  color: var(--text-secondary);
  max-width: 50ch;
  font-size: 1.05rem;
  line-height: 1.6;
}
.hiw-outro-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
.hiw-cta-primary,
.hiw-cta-secondary {
  padding: 0.8rem 1.7rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  transition: transform 250ms ${EASE}, background-color 250ms ${EASE};
}
.hiw-cta-primary {
  background: var(--accent);
  color: #fff;
}
.hiw-cta-secondary {
  border: 1px solid var(--border);
  color: var(--text-primary);
  background: var(--surface);
}
.hiw-cta-primary:hover,
.hiw-cta-secondary:hover { transform: translateY(-1px); }

@media (max-width: 880px) {
  .hiw-grid {
    grid-template-columns: 1fr;
  }
  .hiw-stage-wrap {
    position: sticky;
    top: 96px;
    height: 56vh;
    max-height: 480px;
    z-index: 5;
    background: linear-gradient(180deg, var(--bg) 70%, transparent);
    padding: 0.5rem 0 1rem;
  }
  .hiw-stage { max-width: 360px; }
  .hiw-steps { padding-left: 1.5rem; }
  .hiw-step { min-height: 70vh; }
  .hiw-step-body { max-width: none; }
  .hiw-step-marker { left: -1.5rem; width: 12px; height: 12px; }
  .hiw-rail { left: 5px; }
}

@media (prefers-reduced-motion: reduce) {
  .hiw-stage-piece,
  .hiw-stage-track,
  .hiw-trail-fill,
  .hiw-rail-fill,
  .hiw-step-marker,
  .hiw-zone,
  .hiw-zone-icon,
  .hiw-step,
  .hiw-dot,
  .hiw-scroll-line {
    transition: none !important;
    animation: none !important;
  }
}
`;
