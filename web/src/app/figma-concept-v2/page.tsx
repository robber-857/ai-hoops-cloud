import {
  HeroInsightPanel,
  InteractiveMotionStage,
} from "./ConceptInteractions";

const capabilities = [
  {
    number: "01",
    eyebrow: "UPLOAD & ANALYSE",
    title: "One clip in.",
    copy: "Shooting, dribbling or training footage.",
    stat: "AUTO",
  },
  {
    number: "02",
    eyebrow: "SHOT MECHANICS",
    title: "See the release.",
    copy: "Form, timing and release-path evidence.",
    stat: "48°",
  },
  {
    number: "03",
    eyebrow: "DRIBBLE RHYTHM",
    title: "Read the cadence.",
    copy: "Control, tempo and body position.",
    stat: "1.8Hz",
  },
  {
    number: "04",
    eyebrow: "TRAINING FORM",
    title: "Improve the rep.",
    copy: "A score, the reason and one correction.",
    stat: "86",
  },
] as const;

const metrics = [
  { label: "FORM", value: "92", width: "92%" },
  { label: "TIMING", value: "84", width: "84%" },
  { label: "CONTROL", value: "88", width: "88%" },
] as const;

export default function FigmaConceptV2Page() {
  return (
    <>
      <main className="apex-v2">
        <div className="page-grid" />
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <svg
          className="continuum"
          viewBox="0 0 1440 3100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="energy-blue" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0875c9" stopOpacity="0" />
              <stop offset=".16" stopColor="#1ca7ff" stopOpacity=".92" />
              <stop offset=".62" stopColor="#1e91ff" stopOpacity=".66" />
              <stop offset="1" stopColor="#0875c9" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="energy-orange" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff7a1a" stopOpacity="0" />
              <stop offset=".28" stopColor="#ff8a32" stopOpacity=".92" />
              <stop offset=".72" stopColor="#ff9f55" stopOpacity=".62" />
              <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
            </linearGradient>
            <filter id="soft-blue">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <filter id="soft-orange">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <path
            d="M-120 775 C 180 665, 360 990, 690 890 S 1120 650, 1570 850"
            fill="none"
            stroke="url(#energy-blue)"
            strokeWidth="9"
            filter="url(#soft-blue)"
          />
          <path
            d="M-100 830 C 180 735, 390 1050, 720 948 S 1120 732, 1570 900"
            fill="none"
            stroke="url(#energy-orange)"
            strokeWidth="7"
            filter="url(#soft-orange)"
          />
          <path
            d="M-180 1490 C 185 1310, 405 1695, 760 1515 S 1150 1285, 1620 1510"
            fill="none"
            stroke="url(#energy-blue)"
            strokeWidth="8"
            opacity=".48"
            filter="url(#soft-blue)"
          />
          <path
            d="M-120 1940 C 270 1730, 485 2130, 840 1935 S 1210 1745, 1580 1970"
            fill="none"
            stroke="url(#energy-orange)"
            strokeWidth="8"
            opacity=".62"
            filter="url(#soft-orange)"
          />
          <path
            d="M-160 2720 C 220 2500, 470 2920, 830 2695 S 1210 2490, 1600 2740"
            fill="none"
            stroke="url(#energy-blue)"
            strokeWidth="7"
            opacity=".4"
            filter="url(#soft-blue)"
          />
        </svg>

        <header className="nav">
          <a className="brand" href="#top" aria-label="Apex Sport AI home">
            APEX <span>SPORT AI</span>
            <small>SYDNEY</small>
          </a>
          <nav aria-label="Concept navigation">
            <a href="#analysis">HOW IT WORKS</a>
            <a href="#modes">ANALYSIS</a>
            <a href="#report">REPORT</a>
            <a href="#beta">PRIVATE BETA</a>
          </nav>
          <a className="nav-cta" href="/auth/login">
            LOG IN
          </a>
        </header>

        <section id="top" className="hero">
          <div className="hero-image" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="kicker">
              <span />
              AI BASKETBALL PERFORMANCE LAB
            </p>
            <h1>
              ELEVATE YOUR GAME.
              <br />
              <em className="shine">WITH AI PRECISION.</em>
            </h1>
            <p className="hero-sub">
              Upload one training clip. Get the score, the evidence,
              <br />
              and the next correction.
            </p>
            <div className="hero-actions">
              <a className="primary-btn" href="#beta">
                UPLOAD YOUR TRAINING <span>↗</span>
              </a>
              <a className="secondary-btn" href="#report">
                VIEW SAMPLE REPORT <span>↓</span>
              </a>
            </div>
          </div>

          <HeroInsightPanel />

          <div className="hero-bottom">
            <span>SHOOTING</span>
            <span>DRIBBLING</span>
            <span>TRAINING</span>
            <p>MOTION BECOMES EVIDENCE <b>→</b></p>
          </div>
        </section>

        <section id="analysis" className="capability-section">
          <div className="section-heading">
            <p className="kicker">
              <span />
              01 / PERFORMANCE INTELLIGENCE
            </p>
            <h2>
              ENGINEERED FOR <em>SUPERIORITY.</em>
            </h2>
          </div>

          <div className="capability-grid">
            {capabilities.map((item) => (
              <article key={item.number} className="capability">
                <div className="capability-top">
                  <span>{item.number}</span>
                  <b>{item.stat}</b>
                </div>
                <p>{item.eyebrow}</p>
                <h3>{item.title}</h3>
                <small>{item.copy}</small>
                <div className="signal">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="modes" className="modes-section">
          <div className="modes-title">
            <p className="kicker">
              <span />
              02 / ONE PLATFORM
            </p>
            <h2>
              THREE MOTIONS.
              <br />
              <em>ONE VISUAL LANGUAGE.</em>
            </h2>
            <p>Choose the movement. Apex changes what it measures.</p>
          </div>

          <InteractiveMotionStage />
        </section>

        <section id="report" className="report-section">
          <div className="report-heading">
            <p className="kicker">
              <span />
              03 / INTELLIGENCE REPORT
            </p>
            <h2>
              NOT JUST A SCORE.
              <br />
              <em>A REASON TO MOVE.</em>
            </h2>
          </div>

          <div className="report-board">
            <div className="score-block">
              <small>MOVEMENT SCORE</small>
              <div>
                <strong>86</strong>
                <span>/ 100</span>
              </div>
              <p>STRONG EXECUTION</p>
            </div>
            <div className="standards-block">
              <small>PERFORMANCE STANDARD</small>
              {metrics.map((metric) => (
                <div key={metric.label} className="metric">
                  <span>
                    {metric.label} <b>{metric.value}</b>
                  </span>
                  <i>
                    <b style={{ width: metric.width }} />
                  </i>
                </div>
              ))}
            </div>
            <div className="correction-block">
              <small>NEXT REP</small>
              <blockquote>
                Keep the release path steady through extension.
              </blockquote>
              <p>
                <i />
                ONE CLEAR CORRECTION
              </p>
            </div>
          </div>
        </section>

        <section id="beta" className="beta-section">
          <div>
            <p className="kicker">
              <span />
              PRIVATE BETA / SYDNEY
            </p>
            <h2>
              READY TO BREAK
              <br />
              THE <em>LIMIT?</em>
            </h2>
            <p>Turn the next training clip into your next advantage.</p>
            <a className="primary-btn" href="#top">
              REQUEST EARLY ACCESS <span>↗</span>
            </a>
          </div>
          <div className="beta-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>86</span>
          </div>
        </section>

        <footer>
          <b>
            APEX <span>SPORT AI</span>
          </b>
          <p>AI BASKETBALL PERFORMANCE LAB / SYDNEY</p>
          <p>PRIVATE BETA · 2026</p>
        </footer>
      </main>

      <style>{`
        * { box-sizing: border-box; }
        html { background: #02060d; scroll-behavior: smooth; }
        body { margin: 0; background: #02060d; }

        .apex-v2 {
          --orange: #ff8a32;
          --blue: #249cff;
          --ink: #02060d;
          --paper: #f6f7f3;
          position: relative;
          min-height: 3100px;
          overflow: hidden;
          color: var(--paper);
          background:
            radial-gradient(circle at 81% 8%, rgba(15, 100, 176, .2), transparent 26%),
            radial-gradient(circle at 45% 87%, rgba(255, 93, 24, .12), transparent 30%),
            linear-gradient(180deg, #02060d 0%, #040b13 43%, #03070d 100%);
          font-family: Inter, "Segoe UI", sans-serif;
        }

        .page-grid {
          position: absolute;
          inset: 0;
          opacity: .13;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(180deg, transparent 0, #000 28%, #000 84%, transparent);
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(130px);
          pointer-events: none;
        }
        .ambient-one {
          width: 440px;
          height: 440px;
          right: -120px;
          top: 920px;
          background: rgba(18, 122, 221, .16);
        }
        .ambient-two {
          width: 420px;
          height: 420px;
          left: -160px;
          top: 1740px;
          background: rgba(255, 112, 32, .12);
        }

        .continuum {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 3100px;
          z-index: 2;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .nav {
          position: absolute;
          z-index: 20;
          top: 18px;
          left: 48px;
          right: 48px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid rgba(255,255,255,.17);
          border-radius: 14px;
          padding: 0 18px 0 24px;
          background: rgba(2, 7, 14, .58);
          box-shadow: 0 14px 50px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(22px);
        }

        .nav a { color: inherit; text-decoration: none; }
        .brand {
          display: flex;
          align-items: baseline;
          gap: 4px;
          font-family: Arial, sans-serif;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -.03em;
        }
        .brand > span, footer b span { color: var(--orange); }
        .brand small {
          margin-left: 9px;
          color: rgba(255,255,255,.36);
          font-size: 8px;
          letter-spacing: .24em;
          font-weight: 700;
        }

        .nav nav { display: flex; align-items: center; gap: 34px; }
        .nav nav a {
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .18em;
          color: rgba(255,255,255,.48);
        }
        .nav-cta {
          display: flex;
          min-height: 36px;
          align-items: center;
          padding: 0 17px;
          border-radius: 8px;
          color: #190b03 !important;
          background: var(--orange);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
          box-shadow: 0 0 24px rgba(255, 126, 43, .26);
        }

        .hero {
          position: relative;
          z-index: 5;
          height: 850px;
          overflow: hidden;
        }
        .hero-image {
          position: absolute;
          inset: 0;
          background-image: url("/figma-concept-v2/hero-energy-athlete.png");
          background-position: center top;
          background-size: cover;
        }
        .hero-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(2,6,13,.96) 0%, rgba(2,6,13,.76) 34%, rgba(2,6,13,.08) 65%, rgba(2,6,13,.22) 100%),
            linear-gradient(180deg, rgba(2,6,13,.05) 0%, rgba(2,6,13,.02) 67%, #02060d 100%);
        }

        .hero-copy {
          position: absolute;
          z-index: 4;
          top: 182px;
          left: 76px;
          width: 780px;
        }
        .kicker {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
          color: rgba(255,255,255,.62);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .24em;
        }
        .kicker span {
          display: inline-block;
          width: 30px;
          height: 1px;
          background: var(--orange);
          box-shadow: 0 0 14px rgba(255, 138, 50, .72);
        }
        .hero h1,
        .section-heading h2,
        .modes-title h2,
        .report-heading h2,
        .beta-section h2 {
          font-family: Arial, "Arial Black", sans-serif;
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
        }
        .hero h1 {
          margin: 28px 0 0;
          max-width: 780px;
          font-size: 62px;
          line-height: .91;
          letter-spacing: -.068em;
          white-space: nowrap;
          text-shadow: 0 8px 34px rgba(0,0,0,.58);
        }
        .hero h1 em { font-style: inherit; }
        .shine {
          display: inline-block;
          color: transparent;
          background: linear-gradient(
            105deg,
            #ff7e25 5%,
            #ff994d 32%,
            #fff3e7 48%,
            #ffab69 58%,
            #ff7e25 84%
          );
          background-size: 250% 100%;
          background-position: 120% center;
          -webkit-background-clip: text;
          background-clip: text;
          filter: drop-shadow(0 0 18px rgba(255, 126, 37, .24));
          animation: title-scan 5.4s ease-in-out infinite;
        }
        .hero-sub {
          margin: 25px 0 0;
          color: rgba(255,255,255,.66);
          font-size: 15px;
          line-height: 1.65;
          letter-spacing: -.01em;
        }
        .hero-actions { display: flex; gap: 12px; margin-top: 30px; }
        .hero-actions a, .beta-section a { text-decoration: none; }
        .primary-btn, .secondary-btn {
          display: inline-flex;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border-radius: 8px;
          padding: 0 20px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .16em;
        }
        .primary-btn {
          color: #1b0c04;
          background: var(--orange);
          box-shadow: 0 0 30px rgba(255, 126, 37, .26);
        }
        .secondary-btn {
          color: rgba(255,255,255,.78);
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(4,9,16,.52);
          backdrop-filter: blur(16px);
        }
        .primary-btn span, .secondary-btn span { font-size: 14px; }

        .hero-insight {
          position: absolute;
          z-index: 7;
          right: 72px;
          bottom: 112px;
          width: 372px;
          min-height: 228px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 18px;
          padding: 17px 18px 16px;
          background:
            radial-gradient(circle at 76% 12%, rgba(36,156,255,.16), transparent 38%),
            linear-gradient(145deg, rgba(12, 29, 47, .82), rgba(2, 8, 16, .9));
          backdrop-filter: blur(24px) saturate(124%);
          box-shadow:
            0 28px 74px rgba(0,0,0,.46),
            inset 0 1px 0 rgba(255,255,255,.07);
        }
        .hero-insight::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(112deg, transparent 0 45%, rgba(255,255,255,.035) 52%, transparent 60%);
        }
        .hero-insight-top {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
        }
        .hero-insight-top span,
        .hero-insight-top b {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .18em;
          color: rgba(255,255,255,.48);
        }
        .hero-insight-top span {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .hero-insight-top i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--orange);
          box-shadow: 0 0 12px rgba(255, 138, 50, .8);
        }
        .hero-insight-main {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: .78fr 1.22fr;
          align-items: end;
          gap: 14px;
          margin-top: 14px;
        }
        .hero-score {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: end;
        }
        .hero-score strong {
          font-family: Arial, sans-serif;
          font-size: 55px;
          line-height: .78;
          letter-spacing: -.085em;
        }
        .hero-score > span {
          margin: 0 0 2px 7px;
          color: rgba(255,255,255,.28);
          font-size: 10px;
        }
        .hero-score small {
          grid-column: 1 / -1;
          width: fit-content;
          margin-top: 11px;
          padding-top: 7px;
          border-top: 1px solid rgba(255,138,50,.74);
          color: var(--orange);
          font-size: 6px;
          font-weight: 900;
          letter-spacing: .16em;
        }
        .hero-insight-main svg {
          width: 100%;
          height: 78px;
          overflow: visible;
        }
        .hero-signal-ghost {
          fill: none;
          stroke: rgba(255,255,255,.12);
          stroke-width: 8;
          stroke-linecap: round;
        }
        .hero-insight-main circle {
          fill: #e7f5ff;
          filter: drop-shadow(0 0 5px rgba(36,156,255,.75));
        }
        .hero-insight-main circle.hot {
          fill: var(--orange);
          filter: drop-shadow(0 0 6px rgba(255,138,50,.82));
        }
        .hero-insight-metrics {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          margin-top: 13px;
          padding: 12px 0;
          border-top: 1px solid rgba(255,255,255,.12);
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
        .hero-insight-metrics span {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding: 0 12px;
          border-right: 1px solid rgba(255,255,255,.1);
        }
        .hero-insight-metrics span:first-child { padding-left: 0; }
        .hero-insight-metrics span:last-child {
          padding-right: 0;
          border-right: 0;
        }
        .hero-insight-metrics small {
          color: rgba(255,255,255,.32);
          font-size: 5px;
          font-weight: 900;
          letter-spacing: .13em;
        }
        .hero-insight-metrics b {
          font-family: Arial, sans-serif;
          color: #fff;
          font-size: 13px;
        }
        .hero-cue {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }
        .hero-cue span {
          color: var(--orange);
          font-size: 6px;
          font-weight: 900;
          letter-spacing: .18em;
        }
        .hero-cue p {
          margin: 0;
          color: rgba(255,255,255,.61);
          font-size: 9px;
          line-height: 1.35;
        }

        .hero-insight::before {
          content: "";
          position: absolute;
          top: 0;
          left: 18px;
          width: 64px;
          height: 1px;
          background: linear-gradient(90deg, var(--orange), transparent);
          box-shadow: 0 0 12px rgba(255,138,50,.52);
        }

        .hero-bottom {
          position: absolute;
          z-index: 6;
          left: 52px;
          right: 52px;
          bottom: 28px;
          height: 48px;
          display: flex;
          align-items: center;
          gap: 38px;
          border-top: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.34);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .19em;
        }
        .hero-bottom p { margin-left: auto; }
        .hero-bottom b { color: var(--orange); margin-left: 8px; }

        .capability-section {
          position: relative;
          z-index: 6;
          min-height: 465px;
          padding: 8px 76px 72px;
        }
        .section-heading { text-align: center; }
        .section-heading .kicker { justify-content: center; }
        .section-heading h2 {
          margin: 14px 0 0;
          font-size: 38px;
          line-height: 1;
          letter-spacing: -.055em;
        }
        .section-heading h2 em { color: var(--orange); font-style: inherit; }
        .capability-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 34px;
        }
        .capability {
          position: relative;
          min-height: 235px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 14px;
          padding: 20px;
          background:
            linear-gradient(145deg, rgba(14, 28, 42, .72), rgba(5, 11, 18, .72));
          box-shadow: 0 24px 60px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(18px);
        }
        .capability::after {
          content: "";
          position: absolute;
          inset: auto -30% -50% 20%;
          height: 110px;
          background: radial-gradient(ellipse, rgba(36,156,255,.16), transparent 68%);
        }
        .capability-top { display: flex; justify-content: space-between; align-items: center; }
        .capability-top span {
          color: rgba(255,255,255,.26);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .18em;
        }
        .capability-top b {
          color: rgba(255,255,255,.1);
          font-family: Arial, sans-serif;
          font-size: 34px;
          letter-spacing: -.06em;
        }
        .capability > p {
          margin: 25px 0 0;
          color: var(--orange);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
        }
        .capability h3 {
          margin: 8px 0 0;
          font-family: Arial, sans-serif;
          font-size: 23px;
          letter-spacing: -.045em;
        }
        .capability > small {
          display: block;
          max-width: 210px;
          margin-top: 8px;
          color: rgba(255,255,255,.43);
          font-size: 11px;
          line-height: 1.5;
        }
        .signal {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: 20px;
          display: flex;
          gap: 7px;
          align-items: end;
        }
        .signal i { width: 2px; height: 9px; background: rgba(255,255,255,.22); }
        .signal i:nth-child(2) { height: 17px; background: var(--blue); box-shadow: 0 0 9px var(--blue); }
        .signal i:nth-child(3) { height: 12px; }
        .signal i:nth-child(4) { height: 22px; background: var(--orange); box-shadow: 0 0 9px var(--orange); }
        .signal i:nth-child(5) { height: 14px; }

        .modes-section {
          position: relative;
          z-index: 6;
          min-height: 620px;
          padding: 42px 76px 90px;
        }
        .modes-title {
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          align-items: end;
          margin-bottom: 34px;
        }
        .modes-title .kicker { grid-column: 1 / -1; margin-bottom: 13px; }
        .modes-title h2 {
          margin: 0;
          font-size: 48px;
          line-height: .9;
          letter-spacing: -.065em;
        }
        .modes-title h2 em { color: rgba(255,255,255,.24); font-style: inherit; }
        .modes-title > p:last-child {
          justify-self: end;
          margin: 0 0 4px;
          color: rgba(255,255,255,.45);
          font-size: 12px;
        }
        .motion-stage {
          display: grid;
          grid-template-columns: 250px 1fr;
          min-height: 430px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 16px;
          background: rgba(3, 9, 16, .72);
          box-shadow: 0 30px 80px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(20px);
        }
        .motion-stage aside {
          display: grid;
          grid-template-rows: repeat(3, 1fr);
          border-right: 1px solid rgba(255,255,255,.12);
        }
        .motion-stage button {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 6px;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,.1);
          padding: 0 24px;
          color: rgba(255,255,255,.3);
          background: transparent;
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
          outline: none;
          transition:
            color .28s ease,
            background .28s ease;
        }
        .motion-stage button:last-child { border-bottom: 0; }
        .motion-stage button small { font-size: 7px; letter-spacing: .18em; }
        .motion-stage button span { font-size: 7px; letter-spacing: .18em; }
        .motion-stage button:hover { color: rgba(255,255,255,.72); }
        .motion-stage button:focus-visible {
          box-shadow: inset 0 0 0 2px rgba(255,138,50,.78);
        }
        .motion-stage button.active { color: #fff; background: linear-gradient(90deg, rgba(255,138,50,.08), transparent); }
        .motion-stage button.active::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 2px;
          background: var(--orange);
          box-shadow: 0 0 14px rgba(255,138,50,.68);
        }
        .trajectory {
          position: relative;
          min-width: 0;
          min-height: 430px;
        }
        .trajectory::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .2;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at 50% 40%, #000 5%, transparent 70%);
        }
        .trajectory-label {
          position: absolute;
          z-index: 2;
          top: 26px;
          left: 34px;
          color: rgba(255,255,255,.34);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .2em;
        }
        .trajectory-scene {
          position: absolute;
          z-index: 2;
          inset: 0;
        }
        .trajectory-visual {
          position: absolute;
          z-index: 1;
          top: 34px;
          left: 50%;
          width: min(88%, 820px);
          height: 292px;
          transform: translateX(-50%);
        }
        .trajectory-visual svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .trace-grid line {
          stroke: rgba(255,255,255,.08);
          stroke-width: 1;
          stroke-dasharray: 2 13;
        }
        .trace-ghost {
          fill: none;
          stroke: rgba(255,255,255,.08);
          stroke-width: 12;
          stroke-linecap: round;
        }
        .trace-dot {
          filter: drop-shadow(0 0 8px rgba(255,138,50,.92));
        }
        .trace-caption {
          fill: rgba(255,255,255,.32);
          font-family: Inter, "Segoe UI", sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2.2px;
        }
        .trace-caption-hot { fill: #ff9a4d; }
        .basket-target path:first-child {
          fill: none;
          stroke: rgba(255,255,255,.46);
          stroke-width: 2;
        }
        .basket-target path:last-child {
          fill: none;
          stroke: rgba(255,255,255,.18);
          stroke-width: 1.4;
        }
        .cadence-zone {
          fill: rgba(36,156,255,.025);
          stroke: rgba(36,156,255,.13);
          stroke-dasharray: 4 10;
        }
        .quality-band {
          fill: rgba(255,138,50,.055);
          stroke: rgba(255,138,50,.2);
          stroke-dasharray: 5 10;
        }
        .trajectory-result {
          position: absolute;
          z-index: 3;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: end;
          justify-content: space-between;
          min-height: 112px;
          border-top: 1px solid rgba(255,255,255,.12);
          padding: 22px 32px 24px;
          background: rgba(2,7,13,.72);
        }
        .trajectory-result small, .report-board small {
          color: rgba(255,255,255,.34);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .2em;
        }
        .trajectory-result h3 {
          margin: 9px 0 0;
          font-family: Arial, sans-serif;
          font-size: 24px;
          letter-spacing: -.045em;
        }
        .trajectory-result p {
          margin: 7px 0 0;
          color: rgba(255,255,255,.42);
          font-size: 9px;
          line-height: 1.45;
        }
        .result-metrics { display: flex; gap: 32px; }
        .result-metrics span { display: flex; flex-direction: column; gap: 8px; }
        .result-metrics b { color: var(--orange); font-size: 18px; }

        .report-section {
          position: relative;
          z-index: 6;
          min-height: 565px;
          padding: 40px 76px 84px;
        }
        .report-heading h2 {
          margin: 15px 0 30px;
          font-size: 46px;
          line-height: .9;
          letter-spacing: -.065em;
        }
        .report-heading h2 em { color: rgba(255,255,255,.24); font-style: inherit; }
        .report-board {
          display: grid;
          grid-template-columns: .78fr 1fr 1.2fr;
          min-height: 300px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 16px;
          background: rgba(3,9,16,.72);
          box-shadow: 0 30px 80px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(20px);
        }
        .report-board > div { padding: 28px; border-right: 1px solid rgba(255,255,255,.11); }
        .report-board > div:last-child { border-right: 0; }
        .score-block { display: flex; flex-direction: column; justify-content: space-between; }
        .score-block > div { display: flex; align-items: end; }
        .score-block strong {
          font-family: Arial, sans-serif;
          font-size: 98px;
          line-height: .76;
          letter-spacing: -.09em;
        }
        .score-block span { margin: 0 0 2px 8px; color: rgba(255,255,255,.3); font-size: 12px; }
        .score-block p {
          width: fit-content;
          margin: 0;
          padding-top: 11px;
          border-top: 2px solid var(--orange);
          color: var(--orange);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
        }
        .standards-block { display: flex; flex-direction: column; justify-content: space-between; }
        .metric span {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: rgba(255,255,255,.56);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .12em;
        }
        .metric span b { color: #fff; }
        .metric > i { display: block; height: 2px; background: rgba(255,255,255,.1); }
        .metric > i b {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, var(--blue), var(--orange));
          box-shadow: 0 0 11px rgba(36,156,255,.38);
        }
        .correction-block { display: flex; flex-direction: column; }
        .correction-block blockquote {
          margin: auto 0;
          max-width: 340px;
          font-family: Arial, sans-serif;
          font-size: 30px;
          line-height: 1.04;
          letter-spacing: -.045em;
        }
        .correction-block p {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          color: rgba(255,255,255,.34);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .18em;
        }
        .correction-block p i { width: 28px; height: 1px; background: var(--orange); }

        .beta-section {
          position: relative;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 360px;
          margin: 0 76px 36px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 18px;
          padding: 50px 66px;
          background:
            linear-gradient(110deg, rgba(3,9,16,.94) 30%, rgba(12,28,45,.74) 100%);
          box-shadow: 0 34px 90px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
        }
        .beta-section::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 50%, rgba(36,156,255,.13), transparent 33%);
        }
        .beta-section > div:first-child { position: relative; z-index: 2; }
        .beta-section h2 {
          margin: 17px 0 0;
          font-size: 55px;
          line-height: .87;
          letter-spacing: -.068em;
        }
        .beta-section h2 em { color: var(--orange); font-style: inherit; }
        .beta-section > div > p:nth-of-type(2) {
          margin: 18px 0 24px;
          color: rgba(255,255,255,.48);
          font-size: 12px;
        }
        .beta-orbit {
          position: relative;
          z-index: 2;
          width: 250px;
          height: 250px;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle, rgba(255,138,50,.17), rgba(6,16,28,.42) 56%, transparent 58%);
          box-shadow: inset 0 0 70px rgba(36,156,255,.08), 0 0 80px rgba(36,156,255,.08);
        }
        .beta-orbit i { position: absolute; border-radius: 50%; border: 1px solid rgba(36,156,255,.22); }
        .beta-orbit i:nth-child(1) { inset: 18px; }
        .beta-orbit i:nth-child(2) { inset: 46px; border-color: rgba(255,138,50,.28); }
        .beta-orbit i:nth-child(3) {
          width: 8px;
          height: 8px;
          top: 30px;
          right: 65px;
          border: 0;
          background: var(--orange);
          box-shadow: 0 0 18px var(--orange);
        }
        .beta-orbit span {
          font-family: Arial, sans-serif;
          font-size: 56px;
          font-weight: 900;
          letter-spacing: -.08em;
        }

        footer {
          position: relative;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
          border-top: 1px solid rgba(255,255,255,.1);
          padding: 0 76px;
          color: rgba(255,255,255,.32);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .16em;
        }
        footer b { color: #fff; font-family: Arial, sans-serif; font-size: 13px; letter-spacing: -.02em; }

        @keyframes title-scan {
          0%, 18% { background-position: 120% center; filter: drop-shadow(0 0 12px rgba(255,126,37,.18)); }
          58%, 100% { background-position: -80% center; filter: drop-shadow(0 0 24px rgba(255,126,37,.34)); }
        }

        @media (prefers-reduced-motion: reduce) {
          .shine { animation: none; background-position: 48% center; }
        }

        @media (max-width: 1100px) {
          .nav {
            left: 24px;
            right: 24px;
          }
          .hero-copy {
            left: 48px;
            width: min(650px, calc(100vw - 96px));
          }
          .hero h1 {
            max-width: 690px;
            font-size: clamp(48px, 5.7vw, 60px);
          }
          .hero-insight {
            right: 34px;
            width: 350px;
          }
          .capability-section,
          .modes-section,
          .report-section {
            padding-left: 42px;
            padding-right: 42px;
          }
          .beta-section {
            margin-left: 42px;
            margin-right: 42px;
          }
          .motion-stage { grid-template-columns: 220px 1fr; }
          .result-metrics { gap: 20px; }
        }

        @media (max-width: 900px) {
          .apex-v2 {
            min-width: 0;
            min-height: 0;
          }
          .continuum { display: none; }
          .nav {
            top: 12px;
            left: 16px;
            right: 16px;
            height: 56px;
            border-radius: 12px;
            padding: 0 10px 0 16px;
          }
          .nav nav { display: none; }
          .nav-cta {
            min-height: 34px;
            padding: 0 12px;
            font-size: 7px;
          }
          .hero {
            height: 940px;
            min-height: 100svh;
          }
          .hero-image {
            background-position: 62% top;
            background-size: auto 880px;
          }
          .hero-shade {
            background:
              linear-gradient(90deg, rgba(2,6,13,.97) 0%, rgba(2,6,13,.72) 48%, rgba(2,6,13,.14) 100%),
              linear-gradient(180deg, rgba(2,6,13,.04) 0%, rgba(2,6,13,.1) 50%, #02060d 88%);
          }
          .hero-copy {
            top: 128px;
            left: 24px;
            right: 24px;
            width: auto;
          }
          .hero h1 {
            max-width: 680px;
            font-size: clamp(43px, 8vw, 62px);
            white-space: normal;
          }
          .hero-sub br { display: none; }
          .hero-insight {
            right: 24px;
            bottom: 104px;
            width: min(372px, calc(100vw - 48px));
          }
          .hero-bottom {
            left: 24px;
            right: 24px;
            bottom: 22px;
          }
          .hero-bottom p { display: none; }
          .capability-section,
          .modes-section,
          .report-section {
            min-height: 0;
            padding: 72px 24px;
          }
          .capability-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .modes-title {
            grid-template-columns: 1fr;
            gap: 18px;
          }
          .modes-title > p:last-child {
            justify-self: start;
          }
          .motion-stage {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            min-height: 620px;
          }
          .motion-stage aside {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-template-rows: 1fr;
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,.12);
          }
          .motion-stage button {
            min-height: 84px;
            border-right: 1px solid rgba(255,255,255,.1);
            border-bottom: 0;
            padding: 14px 18px;
            font-size: 14px;
          }
          .motion-stage button:last-child { border-right: 0; }
          .motion-stage button.active::before {
            inset: auto 0 0;
            width: auto;
            height: 2px;
          }
          .trajectory {
            min-height: 532px;
          }
          .trajectory-visual {
            top: 44px;
            width: 94%;
            height: 330px;
          }
          .trajectory-result {
            min-height: 128px;
          }
          .report-board {
            grid-template-columns: .72fr 1fr;
          }
          .report-board > div:nth-child(2) { border-right: 0; }
          .correction-block {
            grid-column: 1 / -1;
            min-height: 220px;
            border-top: 1px solid rgba(255,255,255,.11);
          }
          .beta-section {
            min-height: 360px;
            margin: 0 24px 28px;
            padding: 42px;
          }
          footer { padding: 0 24px; }
        }

        @media (max-width: 600px) {
          .brand small { display: none; }
          .nav-cta { max-width: 112px; text-align: center; }
          .hero {
            height: 940px;
          }
          .hero-image {
            background-position: 67% top;
            background-size: auto 760px;
          }
          .hero-shade {
            background:
              linear-gradient(90deg, rgba(2,6,13,.97) 0%, rgba(2,6,13,.66) 55%, rgba(2,6,13,.18) 100%),
              linear-gradient(180deg, rgba(2,6,13,.02), rgba(2,6,13,.18) 43%, #02060d 76%);
          }
          .hero-copy {
            top: 112px;
            left: 20px;
            right: 20px;
          }
          .kicker {
            font-size: 7px;
            letter-spacing: .18em;
          }
          .kicker span { width: 22px; }
          .hero h1 {
            margin-top: 22px;
            font-size: clamp(38px, 11.4vw, 52px);
            line-height: .94;
            letter-spacing: -.06em;
          }
          .hero-sub {
            max-width: 310px;
            margin-top: 20px;
            font-size: 13px;
          }
          .hero-actions {
            flex-wrap: wrap;
            margin-top: 22px;
          }
          .primary-btn,
          .secondary-btn {
            min-height: 44px;
            padding: 0 15px;
            font-size: 7px;
          }
          .hero-insight {
            right: 16px;
            bottom: 98px;
            width: calc(100vw - 32px);
            min-height: 220px;
            padding: 15px;
          }
          .hero-insight-main {
            grid-template-columns: .82fr 1.18fr;
          }
          .hero-score strong { font-size: 48px; }
          .hero-insight-metrics span { padding: 0 7px; }
          .hero-insight-metrics small { font-size: 4.5px; }
          .hero-cue p { font-size: 8px; }
          .hero-bottom {
            left: 20px;
            right: 20px;
            gap: 16px;
            font-size: 6px;
          }
          .capability-section,
          .modes-section,
          .report-section {
            padding: 64px 20px;
          }
          .section-heading h2 {
            font-size: 32px;
          }
          .capability-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .capability { min-height: 208px; }
          .modes-title h2,
          .report-heading h2 {
            font-size: 38px;
          }
          .motion-stage {
            min-height: 590px;
          }
          .motion-stage button {
            min-height: 76px;
            align-items: center;
            padding: 12px 5px;
            font-size: 11px;
            text-align: center;
          }
          .motion-stage button small { display: none; }
          .motion-stage button span {
            font-size: 5px;
            letter-spacing: .12em;
          }
          .trajectory { min-height: 510px; }
          .trajectory-label {
            top: 20px;
            left: 18px;
            font-size: 6px;
          }
          .trajectory-visual {
            top: 42px;
            width: 100%;
            height: 250px;
          }
          .trajectory-result {
            display: grid;
            align-items: start;
            gap: 16px;
            min-height: 184px;
            padding: 18px;
          }
          .trajectory-result h3 {
            font-size: 20px;
          }
          .result-metrics {
            justify-content: space-between;
            gap: 12px;
          }
          .result-metrics b { font-size: 15px; }
          .report-board { grid-template-columns: 1fr; }
          .report-board > div {
            min-height: 230px;
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,.11);
          }
          .report-board > div:last-child { border-bottom: 0; }
          .correction-block { grid-column: auto; }
          .beta-section {
            align-items: flex-start;
            min-height: 520px;
            margin: 0 20px 24px;
            padding: 36px 28px;
          }
          .beta-section h2 { font-size: 42px; }
          .beta-orbit {
            position: absolute;
            right: -50px;
            bottom: -58px;
            width: 230px;
            height: 230px;
            opacity: .72;
          }
          footer {
            height: auto;
            min-height: 104px;
            flex-wrap: wrap;
            gap: 8px 20px;
            padding: 22px 20px;
          }
        }
      `}</style>
    </>
  );
}
