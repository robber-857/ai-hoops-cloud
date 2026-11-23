"use client";

import { useInterfaceText } from "@/hooks/useInterfaceText";
import Image from "next/image";
import { LanguageSelect } from "@/components/navigation/LanguageSelect";
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
  const t = useInterfaceText();
  return (
    <main className={s.page}>
      <header className={s.header}>
        <a href="#" aria-label={t("Infinity Sport home")}>
          <Image
            src="/academy/infinity-logo.png"
            alt="Infinity Sport"
            width={214}
            height={38}
            priority
          />
        </a>
        <nav aria-label={t("Main navigation")}>
          <a href="#training">{t("Training")}</a>
          <a href="#analysis">{t("Video analysis")}</a>
          <a href="#academy">{t("For academies")}</a>
        </nav>
        <div className={s.headerActions}>
          <LanguageSelect />
          <a className={s.login} href="/auth/login">
            {t("Log in")} <ArrowUpRight size={16} />
          </a>
        </div>
      </header>
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}>
            {t("APEX SPORT AI / BASKETBALL LEARNING PLATFORM")}
          </p>
          <h1>
            {t("Great coaching.")}
            <br />
            {t("Clearer")} <em>{t("progress.")}</em>
          </h1>
          <p className={s.intro}>
            {t("Bring your training, video feedback and player development into one place.")}
          </p>
          <a className={s.primary} href="#training">
            {t("Explore the platform")} <ArrowDown size={17} />
          </a>
          <p className={s.heroNote}>
            {t("Built around the court.")}
            <br />
            {t("Designed for your academy.")}
          </p>
        </div>
        <figure className={s.heroPhoto}>
          <Image
            src="/academy/basketball-court.jpg"
            alt={t("Basketball on an outdoor court")}
            fill
            priority
            sizes="(max-width:760px) 100vw, 50vw"
          />
          <figcaption>
            <small>{t("FROM PRACTICE TO PROGRESS")}</small>
            <b>
              {t("Every player.")}
              <br />{t("A path forward.")}
            </b>
          </figcaption>
          <span className={s.photoTag}>{t("APEX / BASKETBALL")}</span>
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
            {t(text)}
          </div>
        ))}
      </div>
      <section id="training" className={s.section}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>{t("01 / THE TRAINING LIBRARY")}</p>
            <h2>
              {t("The fundamentals.")}
              <br />
              {t("All in one place.")}
            </h2>
          </div>
          <p>
            {t("Three ways to train.")}
            <br />
            {t("One connected learning experience.")}
          </p>
        </div>
        <div className={s.courses}>
          {courses.map((c, i) => (
            <article key={c.title}>
              <div className={s.courseImage}>
                <Image
                  src={`/academy/${c.image}`}
                  alt={t("{0} training", t(c.title))}
                  fill
                  sizes="(max-width:760px) 100vw, 33vw"
                />
                <span>0{i + 1} {t("/ TRAINING")}</span>
              </div>
              <h3>{t(c.title)}</h3>
              <p>{t(c.copy)}</p>
              <small>{t(c.detail)}</small>
            </article>
          ))}
        </div>
      </section>
      <section id="analysis" className={s.analysis}>
        <div className={s.analysisInner}>
          <div>
            <p className={s.eyebrow}>{t("02 / VIDEO TO FEEDBACK")}</p>
            <h2>
              {t("See the movement.")}
              <br />
              <em>{t("Know what’s next.")}</em>
            </h2>
            <p className={s.description}>
              {t("Turn a training clip into a clear breakdown of technique, with practical feedback for the next session.")}
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
                    <b>{t(v.title)}</b>
                    <small>{t(v.copy)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className={s.report}>
            <figcaption>
              <span>{t("Training review")}</span>
              <small>{t("ILLUSTRATIVE PREVIEW")}</small>
            </figcaption>
            <div className={s.reportImage}>
              <Image
                src="/academy/dribbling-promo.webp"
                alt={t("Basketball and training cones on an empty indoor court")}
                fill
                sizes="(max-width:760px) 100vw, 45vw"
              />
              <span>{t("DRIBBLING / TRAINING ILLUSTRATION")}</span>
            </div>
            <div className={s.reportBody}>
              <small>{t("MOVEMENT BREAKDOWN")}</small>
              <h3>{t("One-hand dribble")}</h3>
              <p className={s.observation}>
                <Check size={16} /> {t("Controlled ball position")}
              </p>
              <div className={s.feedback}>
                <small>{t("NEXT SESSION FOCUS")}</small>
                <p>{t("Keep your stance low and your eyes up.")}</p>
              </div>
            </div>
          </figure>
        </div>
      </section>
      <section id="academy" className={s.section}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>{t("03 / YOUR ACADEMY, CONNECTED")}</p>
            <h2>
              {t("Less searching.")}
              <br />
              {t("More coaching.")}
            </h2>
          </div>
          <p>
            {t("Classes, training tasks and player reports.")}
            <br />
            {t("Together, from session to session.")}
          </p>
        </div>
        <div className={s.portal}>
          <aside>
            <b>
              APEX<small>{t("ACADEMY PORTAL")}</small>
            </b>
            <div className={s.selected}>
              <Users size={16} /> {t("My classes")}
            </div>
            <div>
              <ClipboardList size={16} /> {t("Training tasks")}
            </div>
            <div>
              <ChartNoAxesCombined size={16} /> {t("Player reports")}
            </div>
            <small>{t("COACH WORKSPACE")}</small>
          </aside>
          <div className={s.portalMain}>
            <div className={s.portalHeading}>
              <div>
                <small>{t("MY CLASSES / DEVELOPMENT SQUAD")}</small>
                <h3>{t("A clear view of every player.")}</h3>
              </div>
              <span>{t("Sample class")}</span>
            </div>
            <div className={s.tableWrap}>
              <table>
                <caption className={s.srOnly}>
                  {t("Illustrative class training overview")}
                </caption>
                <thead>
                  <tr>
                    <th>{t("Player")}</th>
                    <th>{t("Training focus")}</th>
                    <th>{t("Latest submission")}</th>
                    <th>{t("Report")}</th>
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
                      <td>{t(p.focus)}</td>
                      <td className={p.done ? s.submitted : s.pending}>
                        {p.done ? t("Submitted") : t("Awaiting video")}
                      </td>
                      <td>{p.done ? t("Available") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.sampleNote}>
              {t("Illustrative preview · Sample players and training records")}
            </p>
          </div>
        </div>
        <div className={s.roles}>
          <div>
            <b>{t("For academy owners")}</b>
            <p>{t("Organise classes, coaches and players.")}</p>
          </div>
          <div>
            <b>{t("For coaches")}</b>
            <p>{t("Set training tasks and review submissions.")}</p>
          </div>
          <div>
            <b>{t("For players")}</b>
            <p>{t("See feedback and revisit training reports.")}</p>
          </div>
        </div>
      </section>
      <section className={s.closing}>
        <div>
          <p className={s.eyebrow}>{t("BETTER TRAINING STARTS WITH CLARITY")}</p>
          <h2>
            {t("Built for the next")}
            <br />
            {t("generation of players.")}
          </h2>
        </div>
        <a className={s.primary} href="/auth/login">
          {t("Enter your portal")} <ArrowUpRight size={18} />
        </a>
      </section>
      <footer className={s.footer}>
        <Image
          src="/academy/infinity-logo.png"
          alt="Infinity Sport"
          width={180}
          height={32}
        />
        <p>{t("Apex Sport AI · Basketball learning & development")}</p>
        <span>© {new Date().getFullYear()} Infinity Sport</span>
      </footer>
    </main>
  );
}
