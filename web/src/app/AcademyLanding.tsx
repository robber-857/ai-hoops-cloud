import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  Users,
  ClipboardList,
  ScanLine,
  ChartNoAxesCombined,
  Check,
} from "lucide-react";
import s from "./academy.module.css";

const courses = [
  {
    title: "Shooting",
    copy: "Break down the mechanics behind every shot.",
    detail: "Release · Alignment · Follow-through",
    image: "shooting.jpg",
  },
  {
    title: "Dribbling",
    copy: "Build better ball control, one drill at a time.",
    detail: "Rhythm · Control · Body position",
    image: "dribbling-promo.webp",
  },
  {
    title: "Physical training",
    copy: "Make strong movement part of the programme.",
    detail: "Balance · Stability · Movement quality",
    image: "strength.jpg",
  },
];
export default function AcademyLanding() {
  return (
    <main className={s.page}>
      <header className={s.header}>
        <a href="#" aria-label="Infinity Sport home">
          <Image
            src="/academy/infinity-logo.png"
            alt="Infinity Sport"
            width={214}
            height={38}
            priority
          />
        </a>
        <nav aria-label="Main navigation">
          <a href="#training">Training</a>
          <a href="#analysis">Video analysis</a>
          <a href="#academy">For academies</a>
        </nav>
        <a className={s.login} href="/auth/login">
          Log in <ArrowUpRight size={16} />
        </a>
      </header>
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}>
            APEX SPORT AI / BASKETBALL LEARNING PLATFORM
          </p>
          <h1>
            Great coaching.
            <br />
            Clearer <em>progress.</em>
          </h1>
          <p className={s.intro}>
            Bring your training, video feedback and player development into one
            place.
          </p>
          <a className={s.primary} href="#training">
            Explore the platform <ArrowDown size={17} />
          </a>
          <p className={s.heroNote}>
            Built around the court.
            <br />
            Designed for your academy.
          </p>
        </div>
        <figure className={s.heroPhoto}>
          <Image
            src="/academy/basketball-court.jpg"
            alt="Basketball on an outdoor court"
            fill
            priority
            sizes="(max-width:760px) 100vw, 50vw"
          />
          <figcaption>
            <small>FROM PRACTICE TO PROGRESS</small>
            <b>
              Every player.
              <br />A path forward.
            </b>
          </figcaption>
          <span className={s.photoTag}>APEX / BASKETBALL</span>
        </figure>
      </section>
      <div className={s.strip}>
        {[
          { Icon: Users, text: "Classes & players" },
          { Icon: ClipboardList, text: "Structured training" },
          { Icon: ScanLine, text: "Video analysis" },
          { Icon: ChartNoAxesCombined, text: "Progress reports" },
        ].map(({ Icon, text }) => (
          <div key={text}>
            <Icon size={19} />
            {text}
          </div>
        ))}
      </div>
      <section id="training" className={s.section}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>01 / THE TRAINING LIBRARY</p>
            <h2>
              The fundamentals.
              <br />
              All in one place.
            </h2>
          </div>
          <p>
            Three ways to train.
            <br />
            One connected learning experience.
          </p>
        </div>
        <div className={s.courses}>
          {courses.map((c, i) => (
            <article key={c.title}>
              <div className={s.courseImage}>
                <Image
                  src={`/academy/${c.image}`}
                  alt={`${c.title} training`}
                  fill
                  sizes="(max-width:760px) 100vw, 33vw"
                />
                <span>0{i + 1} / TRAINING</span>
              </div>
              <h3>{c.title}</h3>
              <p>{c.copy}</p>
              <small>{c.detail}</small>
            </article>
          ))}
        </div>
      </section>
      <section id="analysis" className={s.analysis}>
        <div className={s.analysisInner}>
          <div>
            <p className={s.eyebrow}>02 / VIDEO TO FEEDBACK</p>
            <h2>
              See the movement.
              <br />
              <em>Know what’s next.</em>
            </h2>
            <p className={s.description}>
              Turn a training clip into a clear breakdown of technique, with
              practical feedback for the next session.
            </p>
            <ol className={s.steps}>
              {[
                {
                  title: "Upload a training clip",
                  copy: "Shooting, dribbling or physical training.",
                },
                {
                  title: "Review the analysis",
                  copy: "Movement evidence alongside the video.",
                },
                {
                  title: "Take it back to the court",
                  copy: "A clear focus for the next practice.",
                },
              ].map((v, i) => (
                <li key={v.title}>
                  <span>0{i + 1}</span>
                  <div>
                    <b>{v.title}</b>
                    <small>{v.copy}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className={s.report}>
            <figcaption>
              <span>Training review</span>
              <small>ILLUSTRATIVE PREVIEW</small>
            </figcaption>
            <div className={s.reportImage}>
              <Image
                src="/academy/dribbling-promo.webp"
                alt="Basketball and training cones on an empty indoor court"
                fill
                sizes="(max-width:760px) 100vw, 45vw"
              />
              <span>DRIBBLING / TRAINING ILLUSTRATION</span>
            </div>
            <div className={s.reportBody}>
              <small>MOVEMENT BREAKDOWN</small>
              <h3>One-hand dribble</h3>
              <p className={s.observation}>
                <Check size={16} /> Controlled ball position
              </p>
              <div className={s.feedback}>
                <small>NEXT SESSION FOCUS</small>
                <p>Keep your stance low and your eyes up.</p>
              </div>
            </div>
          </figure>
        </div>
      </section>
      <section id="academy" className={s.section}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>03 / YOUR ACADEMY, CONNECTED</p>
            <h2>
              Less searching.
              <br />
              More coaching.
            </h2>
          </div>
          <p>
            Classes, training tasks and player reports.
            <br />
            Together, from session to session.
          </p>
        </div>
        <div className={s.portal}>
          <aside>
            <b>
              APEX<small>ACADEMY PORTAL</small>
            </b>
            <div className={s.selected}>
              <Users size={16} /> My classes
            </div>
            <div>
              <ClipboardList size={16} /> Training tasks
            </div>
            <div>
              <ChartNoAxesCombined size={16} /> Player reports
            </div>
            <small>COACH WORKSPACE</small>
          </aside>
          <div className={s.portalMain}>
            <div className={s.portalHeading}>
              <div>
                <small>MY CLASSES / DEVELOPMENT SQUAD</small>
                <h3>A clear view of every player.</h3>
              </div>
              <span>Sample class</span>
            </div>
            <div className={s.tableWrap}>
              <table>
                <caption className={s.srOnly}>
                  Illustrative class training overview
                </caption>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Training focus</th>
                    <th>Latest submission</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: "Jordan L.",
                      initials: "JL",
                      focus: "Shooting fundamentals",
                      done: true,
                    },
                    {
                      name: "Alex T.",
                      initials: "AT",
                      focus: "Ball control",
                      done: true,
                    },
                    {
                      name: "Sam K.",
                      initials: "SK",
                      focus: "Movement & balance",
                      done: false,
                    },
                  ].map((p) => (
                    <tr key={p.name}>
                      <td>
                        <span className={s.avatar}>{p.initials}</span>
                        {p.name}
                      </td>
                      <td>{p.focus}</td>
                      <td className={p.done ? s.submitted : s.pending}>
                        {p.done ? "Submitted" : "Awaiting video"}
                      </td>
                      <td>{p.done ? "Available" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.sampleNote}>
              Illustrative preview · Sample players and training records
            </p>
          </div>
        </div>
        <div className={s.roles}>
          <div>
            <b>For academy owners</b>
            <p>Organise classes, coaches and players.</p>
          </div>
          <div>
            <b>For coaches</b>
            <p>Set training tasks and review submissions.</p>
          </div>
          <div>
            <b>For players</b>
            <p>See feedback and revisit training reports.</p>
          </div>
        </div>
      </section>
      <section className={s.closing}>
        <div>
          <p className={s.eyebrow}>BETTER TRAINING STARTS WITH CLARITY</p>
          <h2>
            Built for the next
            <br />
            generation of players.
          </h2>
        </div>
        <a className={s.primary} href="/auth/login">
          Enter your portal <ArrowUpRight size={18} />
        </a>
      </section>
      <footer className={s.footer}>
        <Image
          src="/academy/infinity-logo.png"
          alt="Infinity Sport"
          width={180}
          height={32}
        />
        <p>Apex Sport AI · Basketball learning & development</p>
        <span>© {new Date().getFullYear()} Infinity Sport</span>
      </footer>
    </main>
  );
}
