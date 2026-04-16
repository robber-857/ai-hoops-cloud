import Link from "next/link";

import { routes } from "@/lib/routes";

const heroPlayerImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCAZe6bKKEVqlz1zb0oR2TfYTlcpY4Sa30lcWiRybDZ_BQoXB4-T_RIA2T35N7B5RsyBAt8Ul1R26ynNtcsqKMdQL6Hhop_OLfGSe8U3lYWV14ZClA_uxUQoQxfZ0PPvQZhcMJT-Z92DGQZqNCjR0vNcbXeKeGepluJlAMw-r0YDzp-7mFRHy9NmpxTCTptLUc8YydoWqMoeCaAvVHs0ckwBu9V_TAy9xVJ0jGX09Yz9Ha_U4ZxiWSR63HeGOox3Jw-xsoHWvFmvLyK";

const heroFeatureImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDC7xQyUE68Cec1YI_4UlrW7cPtNF2qTkU4wwgZT7Z1nkqevUT1l-p21NTjmfY53oxZlA4ruae9pSkwIJSIgPMNrxpOqOQrCoBsG3tf0saGxHOamO4cCAeVHxgIE5G4imJR1e9uTc9VOPW2cMEMSAHRy8WATJsTywy3ZekfG4dD52h9c1d_LjSiTjYaXiWMxbjtk7inljuw5ASf4NQoufZI-srZ5p-2nmX_YYCe2y1ZToP0DU_oY7X1Lyn484Ub4sTFmSajbkqsi7F4";

const testimonialImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDvt1HCYXAUbiM06VRFm90UlJUhmjl9kMAKAwjXHtXhJ4gzt-9pgW5xoU2ZlQOZQOctjorhiy0xoOTzVY3u6zL2PCTRKJphG_w0vu7eCFMseJt_kOEBIpytdX3Brxe66BrjegNiiatKWxC1lJJMg0YHdirrdXIPmsWZwU0G-EXs0ytkKUEnwO84UuuBpxBeyW3nF8rkhOkcYdH13ujgrlvzfwwe6f0F-PuazOYGRduW1EiBA1kZuIQtO_n5puJTOPj0u6cVBJCKfE2E";

function TierCard({
  title,
  price,
  features,
  featured = false,
  gold = false,
}: {
  title: string;
  price: string;
  features: string[];
  featured?: boolean;
  gold?: boolean;
}) {
  return (
    <article
      className={`relative rounded-[28px] border p-7 ${
        featured
          ? "border-[#ff9f4a] bg-[#1f2020] shadow-[0_0_24px_rgba(255,159,74,0.12)]"
          : "border-white/10 bg-[#0e0e0e]"
      }`}
    >
      {featured ? (
        <div className="absolute right-0 top-0 rounded-bl-xl rounded-tr-[26px] bg-[#ff9f4a] px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#532a00]">
          Most Popular
        </div>
      ) : null}
      <div
        className={`font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-[0.08em] ${
          featured ? "text-[#ff9f4a]" : gold ? "text-[#ffe393]" : "text-white"
        }`}
      >
        {title}
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-5xl font-black italic tracking-[-0.07em] text-white">{price}</span>
        <span className="pb-1 text-white/50">/mo</span>
      </div>
      <ul className="mt-7 space-y-3 text-sm text-white/68">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                featured ? "bg-[#ff9f4a]" : gold ? "bg-[#ffe393]" : "bg-[#ff9f4a]"
              }`}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={routes.auth.login}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-4 text-xs font-black uppercase tracking-[0.2em] transition hover:scale-[1.02] ${
          featured
            ? "bg-[#ff9f4a] text-[#532a00]"
            : gold
              ? "border border-[#ffe393] text-[#ffe393]"
              : "border border-white/14 text-white"
        }`}
      >
        {featured ? "Get Started" : gold ? "Join Elites" : "Start Free"}
      </Link>
    </article>
  );
}

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
        .landing-root { font-family: 'Inter', sans-serif; background:#0e0e0e; color:#fff; }
        .landing-headline, .landing-title, .landing-nav, .landing-kicker, .landing-brand, .landing-button, .landing-tier, .landing-footer-title { font-family:'Space Grotesk', sans-serif; }
        .landing-headline, .landing-title, .landing-tier-title { font-style:italic; font-weight:900; letter-spacing:-0.08em; text-transform:uppercase; }
        .landing-brand { font-style:italic; font-weight:900; letter-spacing:-0.08em; }
        .landing-glass { background:rgba(38,38,38,.6); backdrop-filter:blur(24px); }
        .landing-orange-glow { background:radial-gradient(circle, rgba(255,159,74,.15) 0%, rgba(255,159,74,0) 70%); }
        .landing-red-glow { background:radial-gradient(circle, rgba(255,113,98,.1) 0%, rgba(255,113,98,0) 70%); }
      `}</style>

      <main className="landing-root">
        <nav className="landing-nav sticky top-0 z-50 border-b border-white/5 bg-[rgba(14,14,14,0.72)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-5 py-4 sm:px-8">
            <Link href={routes.home} className="landing-brand text-2xl text-[#ff9f4a]">
              Apexsportai
            </Link>

            <div className="hidden items-center gap-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 md:flex">
              <a href="#training" className="transition hover:text-white">Training</a>
              <a href="#analysis" className="transition hover:text-white">Analysis</a>
              <a href="#tiers" className="transition hover:text-white">Pro League</a>
              <a href="#community" className="transition hover:text-white">Community</a>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href={routes.auth.login}
                className="landing-button inline-flex rounded-md bg-gradient-to-br from-[#ff9f4a] to-[#fd8b00] px-6 py-2.5 text-[12px] font-black tracking-[0.18em] text-[#442100] shadow-[0_0_15px_rgba(255,159,74,0.2)] transition hover:scale-[1.03]"
              >
                Log in
              </Link>
            </div>
          </div>
        </nav>

        <section className="relative overflow-hidden px-5 pb-24 pt-28 sm:px-8">
          <div className="landing-orange-glow pointer-events-none absolute left-[-120px] top-20 h-[520px] w-[520px] rounded-full blur-[120px]" />
          <div className="landing-red-glow pointer-events-none absolute right-[-120px] top-[38%] h-[680px] w-[680px] rounded-full blur-[150px]" />

          <div className="mx-auto grid max-w-[1440px] items-center gap-14 lg:grid-cols-[1.1fr_0.75fr]">
            <div>
              <span className="landing-kicker mb-6 inline-block text-[10px] font-bold uppercase tracking-[0.34em] text-[#ff9f4a]">
                Elite Performance Lab
              </span>
              <h1 className="landing-headline max-w-[760px] text-[clamp(3.5rem,9vw,7rem)] leading-[0.88]">
                EVOLVE YOUR <span className="bg-gradient-to-r from-[#ff9f4a] to-[#ff7162] bg-clip-text text-transparent">GAME</span> WITH AI PRECISION.
              </h1>
              <p className="mt-8 max-w-[520px] text-lg leading-8 text-white/62">
                The world&apos;s most advanced computer vision platform for basketball. Track every shot, analyze every movement, and dominate the court with pro-level insights.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href={routes.auth.login}
                  className="landing-button inline-flex rounded-[18px] bg-gradient-to-br from-[#ff9f4a] to-[#fd8b00] px-8 py-5 text-sm font-black uppercase tracking-[0.18em] text-[#532a00] transition hover:scale-[1.03]"
                >
                  Start Session
                </Link>
                <a
                  href="#analysis"
                  className="landing-button inline-flex rounded-[18px] border border-white/14 px-8 py-5 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/5"
                >
                  Watch Demo
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] shadow-2xl">
              <div className="relative">
                <img src={heroPlayerImage} alt="Basketball player with analysis overlay" className="aspect-[4/5] w-full object-cover grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
                <div className="landing-glass absolute inset-x-6 bottom-6 rounded-[18px] border border-white/12 p-5">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="landing-kicker text-[10px] tracking-[0.24em] text-[#ff9f4a]">Live Analysis</span>
                    <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                      <span className="h-2 w-2 rounded-full bg-[#ff7162] animate-pulse" />
                      System Active
                    </span>
                  </div>
                  <div className="landing-title text-[1.75rem] tracking-[-0.06em]">SHOT ARC: 48.2°</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="analysis" className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <h2 className="landing-title text-[clamp(3rem,8vw,5rem)] leading-[0.9]">
                Engineered for
                <br />
                <span className="text-[#ff9f4a]">Superiority</span>
              </h2>
              <p className="max-w-[380px] text-base leading-8 text-white/60">
                Our neural networks analyze 60 frames per second to provide instantaneous feedback on your form, release, and footwork.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="relative overflow-hidden rounded-[24px] bg-[#1f2020] p-8 md:col-span-2 md:min-h-[320px]">
                <div className="relative z-10 max-w-[360px]">
                  <div className="mb-6 text-2xl text-[#ff9f4a]">✦</div>
                  <h3 className="landing-tier text-[1.95rem] font-bold uppercase leading-none tracking-[-0.04em]">Biomechanical Mapping</h3>
                  <p className="mt-4 text-sm leading-7 text-white/62">
                    Every joint, every flick of the wrist. We map 24 pressure points to ensure your shooting form is mathematically perfect.
                  </p>
                  <div className="landing-kicker mt-10 flex items-center gap-2 text-[10px] tracking-[0.24em] text-[#ff9f4a]">
                    Explore Module <span>→</span>
                  </div>
                </div>
                <img src={heroFeatureImage} alt="Basketball texture" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-20" />
              </article>

              <article className="rounded-[24px] bg-[#1f2020] p-8">
                <div className="mb-6 text-2xl text-[#ff7162]">◔</div>
                <h3 className="landing-tier text-[1.95rem] font-bold uppercase leading-none tracking-[-0.04em]">Velocity Metrics</h3>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  Measure release speed down to the millisecond. Faster release, higher scoring percentage.
                </p>
                <div className="mt-10 border-t border-white/10 pt-8 text-5xl font-black italic tracking-[-0.08em] text-white">
                  0.42s
                </div>
              </article>

              <article className="rounded-[24px] bg-[#1f2020] p-8">
                <div className="mb-6 text-2xl text-[#ffe393]">◉</div>
                <h3 className="landing-tier text-[1.95rem] font-bold uppercase leading-none tracking-[-0.04em]">AI Scouting</h3>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  Identify your patterns and weak spots before your opponents do. Real-time defensive vulnerability mapping.
                </p>
                <div className="mt-10 flex items-center">
                  <span className="h-11 w-11 rounded-full border-2 border-[#0e0e0e] bg-[#262626]" />
                  <span className="-ml-3 h-11 w-11 rounded-full border-2 border-[#0e0e0e] bg-[#262626]" />
                  <span className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0e0e0e] bg-[#ff9f4a] text-xs font-black text-[#532a00]">+12</span>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[24px] bg-[#1f2020] p-8 md:col-span-2 md:min-h-[220px]">
                <h3 className="landing-title text-[clamp(2rem,5vw,3rem)] leading-none">The Performance Portal</h3>
                <p className="mt-4 max-w-[520px] text-sm leading-7 text-white/62">
                  Access your entire history of sessions, compare with pro benchmarks, and receive personalized AI coaching drills every morning.
                </p>
                <div className="absolute inset-y-0 right-0 w-[48%] bg-gradient-to-l from-[#ff9f4a]/10 to-transparent" />
              </article>
            </div>
          </div>
        </section>

        <section id="tiers" className="bg-[#131313] px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-16 text-center">
              <span className="landing-kicker mb-4 block text-[10px] tracking-[0.32em] text-[#ff9f4a]">Choose Your Level</span>
              <h2 className="landing-title text-[clamp(3rem,6vw,4.5rem)]">Training Tiers</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <TierCard
                title="Rookie"
                price="$0"
                features={["Basic Shot Tracking", "5 Sessions per Month", "Community Leaderboard"]}
              />
              <TierCard
                title="All-Star"
                price="$29"
                features={["Advanced Form Analysis", "Unlimited Sessions", "Heat-map Visualization", "AI Coaching Feedback"]}
                featured
              />
              <TierCard
                title="Hall of Fame"
                price="$99"
                features={["Everything in All-Star", "1-on-1 Pro Virtual Review", "Custom Training Plan", "Early Beta Module Access"]}
                gold
              />
            </div>
          </div>
        </section>

        <section id="community" className="px-5 py-24 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] items-center gap-14 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <h2 className="landing-title mb-10 text-[clamp(3rem,8vw,5rem)] leading-[0.9]">
                Voices from the <span className="text-[#ff7162]">Lab</span>
              </h2>

              <div className="space-y-12">
                <div className="relative pl-10">
                  <div className="absolute left-0 top-0 text-4xl text-[#ff9f4a]/55">”</div>
                  <p className="text-[1.45rem] italic leading-[1.45] text-white">
                    &quot;AI Hoops transformed my shooting mechanics in three weeks. The data doesn&apos;t lie, and the results are on the scoreboard.&quot;
                  </p>
                  <div className="mt-5 font-['Space_Grotesk'] text-sm font-bold uppercase tracking-[0.18em]">Marcus Thompson</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/44">D1 College Guard</div>
                </div>

                <div className="relative pl-10">
                  <div className="absolute left-0 top-0 text-4xl text-[#ff7162]/55">”</div>
                  <p className="text-[1.45rem] italic leading-[1.45] text-white">
                    &quot;As a coach, the analysis portal is a game-changer. I can track all 15 of my players&apos; progress remotely with granular detail.&quot;
                  </p>
                  <div className="mt-5 font-['Space_Grotesk'] text-sm font-bold uppercase tracking-[0.18em]">Elena Rodriguez</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/44">Head Coach, Elite Academy</div>
                </div>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-[24px] lg:block">
              <div className="relative">
                <img src={testimonialImage} alt="Night court with glowing hoop" className="h-[600px] w-full object-cover grayscale opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] to-transparent" />
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 pt-8 sm:px-8">
          <div className="mx-auto max-w-[1280px] overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#1f2020] to-[#000000] px-8 py-16 text-center">
            <h2 className="landing-title text-[clamp(3rem,7vw,5rem)] leading-[0.95]">
              Ready to break the <span className="text-[#ff9f4a]">Limit?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[760px] text-lg leading-8 text-white/62">
              Join 50,000+ athletes already using AI Hoops to redefine their potential. Your next personal best starts today.
            </p>
            <Link
              href={routes.auth.login}
              className="landing-button mt-10 inline-flex rounded-full bg-[#ff9f4a] px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-[#532a00] shadow-[0_0_30px_rgba(255,159,74,0.3)] transition hover:scale-[1.03]"
            >
              Join with the lab
            </Link>
          </div>
        </section>

        <footer className="mt-14 bg-[#0a0a0a]">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 text-sm leading-7 md:grid-cols-4 md:px-12">
            <div>
              <div className="mb-5 font-['Space_Grotesk'] text-lg font-bold text-white">AI Hoops</div>
              <p className="text-white/46">
                Pioneering the intersection of artificial intelligence and athletic peak performance.
              </p>
            </div>
            <div>
              <div className="mb-5 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.18em] text-white">Product</div>
              <ul className="space-y-2 text-white/44">
                <li>Training</li>
                <li>Analysis</li>
                <li>Pro League</li>
                <li>Roadmap</li>
              </ul>
            </div>
            <div>
              <div className="mb-5 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.18em] text-white">Company</div>
              <ul className="space-y-2 text-white/44">
                <li>About Us</li>
                <li>Coaching Portal</li>
                <li>Support</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <div className="mb-5 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.18em] text-white">Legal</div>
              <ul className="space-y-2 text-white/44">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/8 px-6 py-8 text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
            © 2024 AI HOOPS PERFORMANCE LAB. ALL RIGHTS RESERVED.
          </div>
        </footer>
      </main>
    </>
  );
}
