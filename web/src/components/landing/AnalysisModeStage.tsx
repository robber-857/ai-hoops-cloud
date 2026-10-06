"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const modes = [
  {
    id: "shooting",
    number: "01",
    label: "Shooting",
    headline: "Read the release.",
    description: "Form, timing and shot mechanics — frame by frame.",
    metrics: [["Release", "48°"], ["Tempo", "0.42s"], ["Form", "A−"]],
  },
  {
    id: "dribbling",
    number: "02",
    label: "Dribbling",
    headline: "See the rhythm.",
    description: "Cadence, control and body position across every sequence.",
    metrics: [["Control", "91"], ["Rhythm", "1.8Hz"], ["Stance", "Stable"]],
  },
  {
    id: "training",
    number: "03",
    label: "Training",
    headline: "Score the action.",
    description: "Complete-rep quality, consistency and the next correction.",
    metrics: [["Quality", "86"], ["Form", "92%"], ["Trend", "+8"]],
  },
] as const;

function ModeGraphic({ mode, reduceMotion }: { mode: (typeof modes)[number]["id"]; reduceMotion: boolean | null }) {
  const transition = { duration: 1.05, ease: [0.22, 1, 0.36, 1] as const };

  if (mode === "shooting") {
    return (
      <svg viewBox="0 0 760 500" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="shoot-arc" x1="120" y1="390" x2="650" y2="80">
            <stop stopColor="#ff8d3b" stopOpacity="0.14" />
            <stop offset="0.5" stopColor="#ff9a50" />
            <stop offset="1" stopColor="#fff4e7" stopOpacity="0.28" />
          </linearGradient>
          <filter id="shoot-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g opacity="0.22">
          {[120, 200, 280, 360, 440].map((y) => <line key={y} x1="70" y1={y} x2="700" y2={y} stroke="white" strokeWidth="1" strokeDasharray="2 13" />)}
        </g>
        <motion.path
          d="M92 405 C225 387 273 92 489 96 C585 98 626 172 675 248"
          fill="none"
          stroke="url(#shoot-arc)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#shoot-glow)"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={transition}
        />
        <motion.circle
          cx="489"
          cy="96"
          r="10"
          fill="#ff9a50"
          filter="url(#shoot-glow)"
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...transition, delay: 0.45 }}
          style={{ transformOrigin: "489px 96px" }}
        />
        <circle cx="489" cy="96" r="34" fill="none" stroke="#ff9a50" strokeOpacity="0.26" />
        <path d="M634 248 h74" stroke="white" strokeOpacity="0.42" strokeWidth="2" />
        <path d="M674 248 v80" stroke="white" strokeOpacity="0.18" strokeWidth="1" />
        <text x="503" y="84" fill="white" fillOpacity="0.46" fontSize="12" letterSpacing="3">RELEASE</text>
      </svg>
    );
  }

  if (mode === "dribbling") {
    return (
      <svg viewBox="0 0 760 500" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="dribble-line" x1="80" y1="250" x2="680" y2="250">
            <stop stopColor="#fff4e7" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#ff9a50" />
            <stop offset="1" stopColor="#fff4e7" stopOpacity="0.1" />
          </linearGradient>
          <filter id="dribble-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 1, 2].map((index) => (
          <motion.path
            key={index}
            d={`M65 ${210 + index * 46} C125 ${95 + index * 40} 182 ${405 - index * 18} 248 ${230 + index * 22} S370 ${80 + index * 38} 438 ${240 + index * 10} S575 ${418 - index * 32} 696 ${180 + index * 38}`}
            fill="none"
            stroke={index === 1 ? "url(#dribble-line)" : "white"}
            strokeOpacity={index === 1 ? 1 : 0.16}
            strokeWidth={index === 1 ? 4 : 1.2}
            strokeLinecap="round"
            filter={index === 1 ? "url(#dribble-glow)" : undefined}
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ ...transition, delay: index * 0.12 }}
          />
        ))}
        {[130, 248, 370, 490, 612].map((x, index) => (
          <motion.circle
            key={x}
            cx={x}
            cy={index % 2 ? 345 : 150}
            r="6"
            fill="#ff9a50"
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...transition, delay: 0.35 + index * 0.08 }}
          />
        ))}
        <text x="72" y="82" fill="white" fillOpacity="0.4" fontSize="12" letterSpacing="3">CADENCE MAP</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 760 500" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="training-loop" x1="160" y1="370" x2="590" y2="120">
          <stop stopColor="#fff4e7" stopOpacity="0.12" />
          <stop offset="0.52" stopColor="#ff9a50" />
          <stop offset="1" stopColor="#fff4e7" stopOpacity="0.12" />
        </linearGradient>
        <filter id="training-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <motion.path
        d="M146 338 C87 233 165 101 294 112 C425 123 376 381 500 389 C635 397 700 221 589 137 C486 58 334 125 326 260 C318 395 178 431 105 363"
        fill="none"
        stroke="url(#training-loop)"
        strokeWidth="4"
        strokeLinecap="round"
        filter="url(#training-glow)"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={transition}
      />
      <motion.circle
        cx="326"
        cy="260"
        r="52"
        fill="none"
        stroke="#ff9a50"
        strokeOpacity="0.28"
        strokeDasharray="4 9"
        initial={reduceMotion ? false : { rotate: -60, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ ...transition, delay: 0.35 }}
        style={{ transformOrigin: "326px 260px" }}
      />
      <circle cx="326" cy="260" r="8" fill="#ff9a50" filter="url(#training-glow)" />
      <text x="346" y="252" fill="white" fillOpacity="0.44" fontSize="12" letterSpacing="3">COMPLETE ACTION</text>
    </svg>
  );
}

export function AnalysisModeStage() {
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]["id"]>("shooting");
  const reduceMotion = useReducedMotion();
  const active = modes.find((mode) => mode.id === activeMode) ?? modes[0];

  return (
    <section id="modes" className="relative border-y border-white/[0.09] bg-[#0a0a0a] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
      <div className="landing-noise pointer-events-none absolute inset-0 opacity-[0.035]" />
      <div className="relative mx-auto max-w-[1344px]">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <div className="landing-kicker text-[#ff9a50]">01 / Analysis modes</div>
            <h2 className="landing-section-heading mt-5 max-w-[720px] text-[clamp(3.35rem,7.6vw,7.2rem)] font-semibold uppercase leading-[0.84] tracking-[-0.075em] text-[#f6f1e9]">
              One platform.
              <br />
              <span className="text-white/34">Three motions.</span>
            </h2>
          </div>
          <p className="max-w-[480px] text-base leading-7 text-white/55 lg:justify-self-end lg:pb-2">
            Choose the movement. Apex changes what it measures.
          </p>
        </div>

        <div className="mt-16 border-t border-white/[0.12]">
          <div className="grid lg:grid-cols-[0.34fr_0.66fr]">
            <div className="flex border-b border-white/[0.12] lg:flex-col lg:border-b-0 lg:border-r">
              {modes.map((mode) => {
                const selected = mode.id === activeMode;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveMode(mode.id)}
                    className="group relative min-h-16 flex-1 cursor-pointer border-r border-white/[0.1] px-2 py-4 text-left outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff9a50] sm:px-5 lg:min-h-[132px] lg:border-b lg:border-r-0 lg:px-0 lg:py-7 lg:last:border-b-0"
                  >
                    {selected ? (
                      <motion.span layoutId="active-mode" className="absolute inset-y-0 left-0 w-[2px] bg-[#ff9a50]" />
                    ) : null}
                    <span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 sm:inline">{mode.number}</span>
                    <span className={`landing-font block text-sm font-semibold uppercase tracking-[-0.02em] transition-colors sm:mt-4 sm:text-lg lg:text-2xl ${selected ? "text-white" : "text-white/34 group-hover:text-white/70"}`}>
                      {mode.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-h-[570px] overflow-hidden sm:min-h-[640px]">
              <div className="landing-spatial-grid pointer-events-none absolute inset-0 opacity-35" />
              <div className="pointer-events-none absolute left-[42%] top-[46%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff8d3b]/10 blur-[100px]" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col"
                >
                  <div className="relative h-[62%] px-3 pt-6 sm:px-8 sm:pt-8 lg:px-12">
                    <div className="h-full w-full">
                      <ModeGraphic mode={active.id} reduceMotion={reduceMotion} />
                    </div>
                  </div>

                  <div className="mt-auto grid gap-8 border-t border-white/[0.12] p-6 sm:grid-cols-[1fr_auto] sm:p-8 lg:p-10">
                    <div>
                      <div className="landing-kicker text-white/30">Sample analysis</div>
                      <h3 className="landing-font mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">{active.headline}</h3>
                      <p className="mt-3 max-w-[440px] text-sm leading-6 text-white/48">{active.description}</p>
                    </div>
                    <div className="flex items-end gap-5 sm:gap-8">
                      {active.metrics.map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30 sm:text-[9px]">{label}</div>
                          <div className="landing-font mt-2 text-lg font-semibold tabular-nums text-[#ff9a50] sm:text-2xl">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
