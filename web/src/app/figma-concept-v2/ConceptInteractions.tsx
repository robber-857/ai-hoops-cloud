"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const modes = [
  {
    id: "shooting",
    number: "01",
    label: "SHOOTING",
    signal: "RELEASE PATH",
    traceLabel: "SHOT 08 / RELEASE PATH",
    headline: "Clean release. Stable extension.",
    cue: "Keep the release path steady through extension.",
    metrics: [
      ["RELEASE", "48°"],
      ["TEMPO", "0.42s"],
      ["CONTROL", "88"],
    ],
  },
  {
    id: "dribbling",
    number: "02",
    label: "DRIBBLING",
    signal: "CADENCE MAP",
    traceLabel: "SEQUENCE 12 / CADENCE MAP",
    headline: "Balanced rhythm. Strong control.",
    cue: "Stay lower as the ball crosses the body.",
    metrics: [
      ["CADENCE", "1.8Hz"],
      ["CONTROL", "91"],
      ["STANCE", "STABLE"],
    ],
  },
  {
    id: "training",
    number: "03",
    label: "TRAINING",
    signal: "FORM CONTROL",
    traceLabel: "REP 06 / QUALITY TRACE",
    headline: "Rep quality, made visible.",
    cue: "Brace the core through the full action.",
    metrics: [
      ["POSTURE", "90"],
      ["EXECUTION", "90"],
      ["CONSISTENCY", "99"],
    ],
  },
] as const;

type ModeId = (typeof modes)[number]["id"];

function TracePoint({
  cx,
  cy,
  delay,
  reduceMotion,
}: {
  cx: number;
  cy: number;
  delay: number;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.g
      initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <circle
        cx={cx}
        cy={cy}
        r="18"
        fill="rgba(255,138,50,.08)"
        stroke="#ff8a32"
        strokeOpacity=".52"
        strokeWidth="1.4"
      />
      <circle
        cx={cx}
        cy={cy}
        r="7"
        fill="#ff9a4d"
        stroke="#fff4e7"
        strokeOpacity=".86"
        strokeWidth="1.2"
        className="trace-dot"
      />
    </motion.g>
  );
}

function ShootingTrace({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <svg viewBox="0 0 760 360" aria-hidden="true">
      <defs>
        <linearGradient id="v2-shooting-line" x1="68" y1="290" x2="704" y2="72">
          <stop stopColor="#249cff" stopOpacity=".24" />
          <stop offset=".46" stopColor="#8fd1ff" />
          <stop offset="1" stopColor="#ff8a32" />
        </linearGradient>
        <filter id="v2-shooting-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="trace-grid">
        {[82, 148, 214, 280].map((y) => (
          <line key={y} x1="54" y1={y} x2="714" y2={y} />
        ))}
      </g>
      <path className="trace-ghost" d="M68 290 C210 276 264 72 468 72 C596 72 650 168 704 242" />
      <motion.path
        d="M68 290 C210 276 264 72 468 72 C596 72 650 168 704 242"
        fill="none"
        stroke="url(#v2-shooting-line)"
        strokeWidth="4.5"
        strokeLinecap="round"
        filter="url(#v2-shooting-glow)"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <TracePoint cx={68} cy={290} delay={0.16} reduceMotion={reduceMotion} />
      <TracePoint cx={468} cy={72} delay={0.62} reduceMotion={reduceMotion} />
      <TracePoint cx={704} cy={242} delay={0.92} reduceMotion={reduceMotion} />
      <g className="basket-target">
        <path d="M685 242 H735 M698 242 V318" />
        <path d="M698 255 L709 313 M713 255 L715 315 M729 255 L721 313" />
      </g>
      <text x="488" y="58" className="trace-caption">
        RELEASE
      </text>
    </svg>
  );
}

function DribblingTrace({ reduceMotion }: { reduceMotion: boolean | null }) {
  const path =
    "M70 235 C108 235 120 110 160 110 S214 336 258 336 S312 118 362 118 S418 332 472 332 S526 126 584 126 S642 286 700 286";

  return (
    <svg viewBox="0 0 760 360" aria-hidden="true">
      <defs>
        <linearGradient id="v2-dribble-line" x1="70" y1="180" x2="700" y2="180">
          <stop stopColor="#249cff" stopOpacity=".28" />
          <stop offset=".45" stopColor="#e7f4ff" />
          <stop offset="1" stopColor="#ff8a32" />
        </linearGradient>
        <filter id="v2-dribble-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="3.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="trace-grid">
        {[82, 148, 214, 280].map((y) => (
          <line key={y} x1="54" y1={y} x2="714" y2={y} />
        ))}
      </g>
      <rect x="54" y="92" width="660" height="250" rx="12" className="cadence-zone" />
      <path className="trace-ghost" d={path} />
      <motion.path
        d={path}
        fill="none"
        stroke="url(#v2-dribble-line)"
        strokeWidth="4.2"
        strokeLinecap="round"
        filter="url(#v2-dribble-glow)"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <TracePoint cx={160} cy={110} delay={0.28} reduceMotion={reduceMotion} />
      <TracePoint cx={258} cy={336} delay={0.46} reduceMotion={reduceMotion} />
      <TracePoint cx={362} cy={118} delay={0.61} reduceMotion={reduceMotion} />
      <TracePoint cx={472} cy={332} delay={0.77} reduceMotion={reduceMotion} />
      <TracePoint cx={584} cy={126} delay={0.92} reduceMotion={reduceMotion} />
      <text x="54" y="72" className="trace-caption">
        HAND-TO-FLOOR RHYTHM
      </text>
      <text x="615" y="72" className="trace-caption trace-caption-hot">
        1.8Hz
      </text>
    </svg>
  );
}

function TrainingTrace({ reduceMotion }: { reduceMotion: boolean | null }) {
  const path = "M72 276 C150 272 176 128 264 126 S390 278 474 254 S568 92 686 112";

  return (
    <svg viewBox="0 0 760 360" aria-hidden="true">
      <defs>
        <linearGradient id="v2-training-line" x1="72" y1="276" x2="686" y2="112">
          <stop stopColor="#249cff" stopOpacity=".25" />
          <stop offset=".52" stopColor="#f1f7fb" />
          <stop offset="1" stopColor="#ff8a32" />
        </linearGradient>
        <filter id="v2-training-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="trace-grid">
        {[82, 148, 214, 280].map((y) => (
          <line key={y} x1="54" y1={y} x2="714" y2={y} />
        ))}
      </g>
      <rect x="54" y="92" width="660" height="76" rx="12" className="quality-band" />
      <text x="68" y="116" className="trace-caption">
        TARGET QUALITY BAND
      </text>
      <path className="trace-ghost" d={path} />
      <motion.path
        d={path}
        fill="none"
        stroke="url(#v2-training-line)"
        strokeWidth="4.4"
        strokeLinecap="round"
        filter="url(#v2-training-glow)"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.12, ease: [0.22, 1, 0.36, 1] }}
      />
      <TracePoint cx={72} cy={276} delay={0.16} reduceMotion={reduceMotion} />
      <TracePoint cx={264} cy={126} delay={0.45} reduceMotion={reduceMotion} />
      <TracePoint cx={474} cy={254} delay={0.71} reduceMotion={reduceMotion} />
      <TracePoint cx={686} cy={112} delay={0.96} reduceMotion={reduceMotion} />
      <text x="642" y="92" className="trace-caption trace-caption-hot">
        99
      </text>
    </svg>
  );
}

function ModeTrace({
  mode,
  reduceMotion,
}: {
  mode: ModeId;
  reduceMotion: boolean | null;
}) {
  if (mode === "dribbling") {
    return <DribblingTrace reduceMotion={reduceMotion} />;
  }

  if (mode === "training") {
    return <TrainingTrace reduceMotion={reduceMotion} />;
  }

  return <ShootingTrace reduceMotion={reduceMotion} />;
}

export function HeroInsightPanel() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      className="hero-insight"
      aria-label="Sample AI performance analysis"
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.46, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="hero-insight-top">
        <span>
          <i />
          AI MOTION READ
        </span>
        <b>SAMPLE / 08</b>
      </div>

      <div className="hero-insight-main">
        <div className="hero-score">
          <strong>86</strong>
          <span>/100</span>
          <small>STRONG EXECUTION</small>
        </div>
        <svg viewBox="0 0 190 82" aria-hidden="true">
          <defs>
            <linearGradient id="hero-signal" x1="10" y1="58" x2="178" y2="18">
              <stop stopColor="#249cff" />
              <stop offset=".58" stopColor="#d8efff" />
              <stop offset="1" stopColor="#ff8a32" />
            </linearGradient>
            <filter id="hero-signal-glow">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M8 62 C45 60 55 22 96 25 S148 58 182 17" className="hero-signal-ghost" />
          <motion.path
            d="M8 62 C45 60 55 22 96 25 S148 58 182 17"
            fill="none"
            stroke="url(#hero-signal)"
            strokeWidth="2.4"
            strokeLinecap="round"
            filter="url(#hero-signal-glow)"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.72, duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          />
          <circle cx="8" cy="62" r="3.5" />
          <circle cx="96" cy="25" r="3.5" />
          <circle cx="182" cy="17" r="3.5" className="hot" />
        </svg>
      </div>

      <div className="hero-insight-metrics">
        <span>
          <small>POSTURE</small>
          <b>90</b>
        </span>
        <span>
          <small>EXECUTION</small>
          <b>90</b>
        </span>
        <span>
          <small>CONSISTENCY</small>
          <b>99</b>
        </span>
      </div>

      <div className="hero-cue">
        <span>NEXT REP</span>
        <p>Keep the release steady through extension.</p>
      </div>
    </motion.aside>
  );
}

export function InteractiveMotionStage() {
  const [activeMode, setActiveMode] = useState<ModeId>("shooting");
  const reduceMotion = useReducedMotion();
  const active = modes.find((mode) => mode.id === activeMode) ?? modes[0];

  return (
    <div className="motion-stage">
      <aside aria-label="Analysis modes">
        {modes.map((mode) => {
          const selected = mode.id === activeMode;

          return (
            <button
              key={mode.id}
              type="button"
              className={selected ? "active" : undefined}
              aria-pressed={selected}
              onClick={() => setActiveMode(mode.id)}
            >
              <small>{mode.number}</small>
              {mode.label}
              <span>{mode.signal}</span>
            </button>
          );
        })}
      </aside>

      <div className="trajectory">
        <AnimatePresence mode="wait">
          <motion.div
            className="trajectory-scene"
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="trajectory-label">{active.traceLabel}</div>
            <div className="trajectory-visual">
              <ModeTrace mode={active.id} reduceMotion={reduceMotion} />
            </div>
            <div className="trajectory-result">
              <div>
                <small>AI READ</small>
                <h3>{active.headline}</h3>
                <p>{active.cue}</p>
              </div>
              <div className="result-metrics">
                {active.metrics.map(([label, value]) => (
                  <span key={label}>
                    <small>{label}</small>
                    <b>{value}</b>
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
