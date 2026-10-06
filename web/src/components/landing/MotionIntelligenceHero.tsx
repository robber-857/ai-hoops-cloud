"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import { routes } from "@/lib/routes";

const particles = [
  { left: "18%", top: "30%", delay: 0.1 },
  { left: "29%", top: "16%", delay: 1.4 },
  { left: "73%", top: "20%", delay: 0.7 },
  { left: "83%", top: "44%", delay: 2.1 },
  { left: "69%", top: "78%", delay: 1.1 },
  { left: "38%", top: "86%", delay: 2.8 },
  { left: "12%", top: "64%", delay: 1.8 },
  { left: "51%", top: "9%", delay: 2.4 },
] as const;

function MotionCore({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="relative aspect-square w-full" aria-hidden="true">
      <div className="landing-core-aura absolute inset-[14%] rounded-full" />
      <motion.div
        className="landing-core-orbit absolute inset-[7%] rounded-full border border-white/[0.11]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute left-[15%] top-[12%] h-1.5 w-1.5 rounded-full bg-[#ff9a50] shadow-[0_0_18px_5px_rgba(255,143,61,.5)]" />
        <span className="absolute bottom-[8%] right-[21%] h-1 w-1 rounded-full bg-white/80 shadow-[0_0_12px_3px_rgba(255,255,255,.28)]" />
      </motion.div>

      <motion.div
        className="absolute inset-[15%] rounded-[44%] border border-[#ff9a50]/25"
        animate={reduceMotion ? undefined : { rotate: -360, borderRadius: ["44%", "50%", "44%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="landing-core-disc absolute inset-[22%] overflow-hidden rounded-full border border-white/[0.14]"
        animate={reduceMotion ? undefined : { rotate: [0, 4, 0, -4, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="landing-core-disc-grid absolute inset-0" />
        <div className="absolute inset-[9%] rounded-full border border-white/[0.07]" />
        <div className="absolute inset-[28%] rounded-full border border-[#ff9a50]/30 bg-black/20 shadow-[0_0_45px_rgba(255,134,47,.22)]" />
        <motion.div
          className="landing-core-sweep absolute -inset-[25%]"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
        />
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="core-wave" x1="40" y1="100" x2="356" y2="300">
              <stop stopColor="#fff4e7" stopOpacity="0.1" />
              <stop offset="0.42" stopColor="#ff9a50" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff4e7" stopOpacity="0.15" />
            </linearGradient>
            <filter id="core-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <motion.path
            d="M25 236 C78 98 148 316 207 170 C261 38 316 273 377 121"
            fill="none"
            stroke="url(#core-wave)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="16 10"
            filter="url(#core-glow)"
            animate={reduceMotion ? undefined : { strokeDashoffset: [0, -78] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M31 271 C105 202 130 230 188 114 C236 18 281 281 366 218"
            fill="none"
            stroke="#fff4e7"
            strokeOpacity="0.19"
            strokeWidth="1"
            strokeDasharray="3 8"
            animate={reduceMotion ? undefined : { strokeDashoffset: [0, 44] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          <circle cx="207" cy="170" r="5.5" fill="#ff9a50" filter="url(#core-glow)" />
          <circle cx="207" cy="170" r="17" fill="none" stroke="#ff9a50" strokeOpacity="0.32" />
        </svg>
      </motion.div>

      <svg viewBox="0 0 800 800" className="absolute inset-0 h-full w-full overflow-visible">
        <motion.ellipse
          cx="400"
          cy="400"
          rx="345"
          ry="155"
          fill="none"
          stroke="#fff4e7"
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeDasharray="4 12"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "400px 400px" }}
        />
        <motion.ellipse
          cx="400"
          cy="400"
          rx="318"
          ry="118"
          fill="none"
          stroke="#ff9a50"
          strokeOpacity="0.3"
          strokeWidth="1.4"
          strokeDasharray="88 230"
          animate={reduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "400px 400px" }}
        />
      </svg>

      {particles.map((particle) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          className="absolute h-1 w-1 rounded-full bg-[#ffb071]"
          style={{ left: particle.left, top: particle.top }}
          animate={reduceMotion ? undefined : { opacity: [0.18, 0.9, 0.18], scale: [0.8, 1.5, 0.8] }}
          transition={{ duration: 3.8, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function MotionIntelligenceHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const coreX = useSpring(pointerX, { stiffness: 68, damping: 22, mass: 0.8 });
  const coreY = useSpring(pointerY, { stiffness: 68, damping: 22, mass: 0.8 });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const coreScale = useTransform(scrollYProgress, [0, 0.82], [1, 1.34]);
  const coreRotate = useTransform(scrollYProgress, [0, 0.82], [0, 13]);
  const contentY = useTransform(scrollYProgress, [0, 0.7], [0, -54]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.66], [1, 0.18]);
  const railScale = useTransform(scrollYProgress, [0, 0.86], [0.08, 1]);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 26);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 18);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative h-[138svh] bg-[#070707] md:h-[152svh]"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="landing-noise pointer-events-none absolute inset-0 opacity-[0.055]" />
        <div className="landing-spatial-grid pointer-events-none absolute inset-0 opacity-55" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,transparent_0%,rgba(7,7,7,.08)_36%,#070707_82%)]" />

        <motion.div
          className="pointer-events-none absolute left-1/2 top-[51%] w-[min(104vw,920px)] -translate-x-1/2 -translate-y-1/2 sm:top-[52%]"
          style={{
            x: reduceMotion ? 0 : coreX,
            y: reduceMotion ? 0 : coreY,
            scale: reduceMotion ? 1 : coreScale,
            rotate: reduceMotion ? 0 : coreRotate,
          }}
        >
          <MotionCore reduceMotion={reduceMotion} />
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 top-[15%] z-10 h-[55%] bg-[radial-gradient(ellipse_at_center,rgba(7,7,7,.52)_0%,rgba(7,7,7,.16)_42%,transparent_72%)]" />

        <motion.div
          className="relative z-20 mx-auto flex h-full max-w-[1440px] flex-col items-center px-5 pb-8 pt-[18svh] text-center sm:px-8 sm:pt-[17svh] lg:px-12"
          style={{ y: reduceMotion ? 0 : contentY, opacity: reduceMotion ? 1 : contentOpacity }}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="landing-kicker flex items-center gap-3 text-[#ff9a50]"
          >
            <span className="h-px w-7 bg-[#ff9a50]" />
            Apex Sport AI / Motion Intelligence
            <span className="h-px w-7 bg-[#ff9a50]" />
          </motion.div>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
            className="landing-hero-heading mt-5 max-w-[1220px] text-[clamp(3.45rem,10.4vw,9.5rem)] font-semibold uppercase leading-[0.82] tracking-[-0.085em] text-[#f6f1e9]"
          >
            See the move.
            <br />
            <span className="landing-shine-text">Know the why.</span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-[560px] text-base leading-7 text-white/66 sm:text-lg"
          >
            Training video, decoded into a score and what to improve next.
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7"
          >
            <Link
              href={routes.auth.register}
              className="landing-font group inline-flex min-h-12 items-center gap-3 rounded-full bg-[#ff8d3b] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#221005] outline-none transition duration-300 hover:bg-[#ffac6f] focus-visible:ring-2 focus-visible:ring-[#ffc49a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#070707]"
            >
              Join private beta
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>

          <div className="mt-auto w-full pb-1">
            <div className="mx-auto flex max-w-[1344px] items-end justify-between border-b border-white/[0.13] pb-4">
              <div className="hidden items-center gap-8 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/42 sm:flex">
                <span>Shooting</span>
                <span>Dribbling</span>
                <span>Training</span>
              </div>
              <a
                href="#modes"
                className="landing-font ml-auto inline-flex min-h-11 items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/58 transition hover:text-white"
              >
                Explore analysis
                <ArrowDown className="h-3.5 w-3.5 text-[#ff9a50]" />
              </a>
            </div>
            <div className="mx-auto h-px max-w-[1344px] overflow-hidden bg-white/[0.05]">
              <motion.div className="h-full origin-left bg-[#ff9a50]" style={{ scaleX: reduceMotion ? 1 : railScale }} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
