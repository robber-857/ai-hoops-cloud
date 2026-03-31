import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  accentLabel: string;
  accentValue: string;
  footerPrompt: string;
  footerHref: string;
  footerAction: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  accentLabel,
  accentValue,
  footerPrompt,
  footerHref,
  footerAction,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,143,77,0.18),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(61,152,255,0.18),_transparent_26%),linear-gradient(145deg,_#07111f_0%,_#0d1b2e_42%,_#081423_100%)] text-white">
      <div className="min-h-screen bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:96px_96px]">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="flex items-center justify-between">
            <Link
              href={routes.home}
              className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.28em] text-white/72 uppercase"
            >
              <span className="inline-flex h-3 w-3 rounded-full bg-[#ff8e3d] shadow-[0_0_24px_rgba(255,142,61,0.85)]" />
              AI HOOPS CLOUD
            </Link>
            <Button
              asChild
              variant="ghost"
              className="rounded-full border border-white/12 bg-white/6 px-4 text-white hover:bg-white/12"
            >
              <Link href={routes.pose2d.main}>Back to Studio</Link>
            </Button>
          </div>

          <div className="max-w-xl py-16 lg:py-20">
            <p className="mb-5 text-xs font-semibold tracking-[0.34em] text-[#ffb27d] uppercase">
              {eyebrow}
            </p>
            <h1 className="max-w-lg text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/72 sm:text-lg">
              {description}
            </p>

            <div className="mt-10 flex max-w-md items-end justify-between border-t border-white/12 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/44">
                  {accentLabel}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                  {accentValue}
                </p>
              </div>
              <div className="text-right text-sm leading-6 text-white/56">
                <p>Secure auth</p>
                <p>FastAPI + PostgreSQL</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 text-sm text-white/68 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.24em] text-white/38">01</p>
              <p>Username, phone, and email flows all route into the same backend.</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.24em] text-white/38">02</p>
              <p>Verification-code actions are wired so you can test the real request path now.</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.24em] text-white/38">03</p>
              <p>Session state persists locally so you can move into the analysis workspace after sign-in.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
          <div className="w-full border border-white/12 bg-white/8 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-8">
            {children}
            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm text-white/55">
              <p>{footerPrompt}</p>
              <Link href={footerHref} className="font-medium text-[#ffb27d] transition hover:text-white">
                {footerAction}
              </Link>
            </div>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
