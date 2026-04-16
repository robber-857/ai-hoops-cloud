'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  MonitorPlay,
  MoveRight,
  Sparkles,
} from 'lucide-react';

import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type AnalysisMode = 'shooting' | 'dribbling' | 'training';

type PoseWorkspaceShellProps = {
  mode: AnalysisMode;
  hasUpload: boolean;
  children: React.ReactNode;
};

type ModeConfig = {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  description: string;
  accentText: string;
  accentBorder: string;
  accentSurface: string;
  accentGlow: string;
  accentBar: string;
  accentButton: string;
  accentButtonMuted: string;
  sampleLabel: string;
  sampleTitle: string;
  sampleDescription: string;
  templates: string[];
  guide: string[];
  stats: Array<{ label: string; value: string }>;
};

type DribblingTemplateDemo = {
  id: string;
  label: string;
  motionLabel: string;
  viewLabel: string;
  demoSrc: string;
  zoomSrc?: string;
  demoDescription: string;
  zoomDescription?: string;
};

const dribblingTemplateDemos: DribblingTemplateDemo[] = [
  {
    id: 'front-crossover',
    label: 'Narrow Crossover',
    motionLabel: 'Crossover',
    viewLabel: 'Front View',
    demoSrc: '/demos/dribbling/narrowcrossover.mp4',
    zoomSrc: '/demos/dribbling/narrowcrossover_zoomin.mp4',
    demoDescription:
      'Front-angle crossover demo for comparing cadence, shoulder level, and the ball transfer path before upload.',
    zoomDescription:
      '360 zoom-in clip for crossover. This shared view is used by both the front and side crossover templates.',
  },
  {
    id: 'front-onehandoneside',
    label: 'One Hand One Side',
    motionLabel: 'One Hand One Side',
    viewLabel: 'Front View',
    demoSrc: '/demos/dribbling/front_onehandoneside.mp4',
    zoomSrc: '/demos/dribbling/onehandoneside_zoomin.mp4',
    demoDescription:
      'Front-angle one-hand one-side demo for checking handle height, torso balance, and ball return rhythm.',
    zoomDescription:
      '360 zoom-in clip for one-hand one-side. This shared view is used by both the front and side templates.',
  },
  {
    id: 'front-onehand-v',
    label: 'One Hand V',
    motionLabel: 'One Hand V',
    viewLabel: 'Front View',
    demoSrc: '/demos/dribbling/front_onehand-v.mp4',
    zoomSrc: '/demos/dribbling/onehand-v_zoomin.mp4',
    demoDescription:
      'Front-angle one-hand V demo for inspecting wrist rhythm, handle width, and the return path into the next cycle.',
    zoomDescription:
      '360 zoom-in clip for one-hand V so players can study the tighter hand path and timing in more detail.',
  },
  {
    id: 'side-crossover',
    label: 'Narrow Crossover',
    motionLabel: 'Crossover',
    viewLabel: 'Side View',
    demoSrc: '/demos/dribbling/side_narrowcrossover.mp4',
    zoomSrc: '/demos/dribbling/narrowcrossover_zoomin.mp4',
    demoDescription:
      'Side-angle crossover demo for checking stance depth, hip timing, and how the dribble travels across the body.',
    zoomDescription:
      '360 zoom-in clip for crossover. This shared view is used by both the front and side crossover templates.',
  },
  {
    id: 'side-onehandoneside',
    label: 'One Hand One Side',
    motionLabel: 'One Hand One Side',
    viewLabel: 'Side View',
    demoSrc: '/demos/dribbling/side_onehandoneside.mp4',
    zoomSrc: '/demos/dribbling/onehandoneside_zoomin.mp4',
    demoDescription:
      'Side-angle one-hand one-side demo for comparing posture, elbow position, and ball control through each repetition.',
    zoomDescription:
      '360 zoom-in clip for one-hand one-side. This shared view is used by both the front and side templates.',
  },
];

const modeConfig: Record<AnalysisMode, ModeConfig> = {
  shooting: {
    eyebrow: 'Shooting Form Lab',
    titleLead: 'Build a cleaner',
    titleAccent: 'release motion',
    description:
      'Keep template preview, upload workflow, and AI analysis inside one focused workspace designed for repeatable shooting reviews.',
    accentText: 'text-sky-300',
    accentBorder: 'border-sky-400/20',
    accentSurface: 'from-sky-500/18 via-slate-950 to-slate-950',
    accentGlow: 'bg-sky-400/18',
    accentBar: 'bg-sky-300',
    accentButton: 'border-sky-300/30 bg-sky-300 text-slate-950 hover:bg-sky-200',
    accentButtonMuted:
      'border-sky-300/18 bg-sky-300/10 text-sky-100 hover:border-sky-300/35 hover:bg-sky-300/16',
    sampleLabel: 'Front / Side template preview',
    sampleTitle: 'Example release video placeholder',
    sampleDescription:
      'A selected shooting template will later swap in its own demo clip here so users can compare setup, pocket, and release timing before uploading.',
    templates: ['Front Form', 'Side Form', 'Pocket Rhythm'],
    guide: [
      'Use a steady camera and keep the full upper body in frame.',
      'Leave a short pause before the last repetition ends.',
      'Template-linked preview switching can be connected later.',
    ],
    stats: [
      { label: 'Templates', value: '03' },
      { label: 'Preview', value: 'Ready' },
      { label: 'Upload', value: 'Cloud' },
    ],
  },
  dribbling: {
    eyebrow: 'Dribbling Motion Lab',
    titleLead: 'Sharpen your',
    titleAccent: 'ball-control rhythm',
    description:
      'A calmer, more premium review surface for crossover and control drills, with demo preview space ready for multiple templates.',
    accentText: 'text-fuchsia-300',
    accentBorder: 'border-fuchsia-400/20',
    accentSurface: 'from-fuchsia-500/18 via-slate-950 to-slate-950',
    accentGlow: 'bg-fuchsia-400/18',
    accentBar: 'bg-fuchsia-300',
    accentButton:
      'border-fuchsia-300/30 bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200',
    accentButtonMuted:
      'border-fuchsia-300/18 bg-fuchsia-300/10 text-fuchsia-100 hover:border-fuchsia-300/35 hover:bg-fuchsia-300/16',
    sampleLabel: 'Front / Side dribble template',
    sampleTitle: 'Example handle preview placeholder',
    sampleDescription:
      'Use this space for each dribbling template demo later, so users can compare cadence, crossover path, and body stance before upload.',
    templates: ['Narrow Crossover', 'One Hand Height', 'Side Control'],
    guide: [
      'Keep both feet visible and avoid cutting off the ball path.',
      'Use enough clip length to capture several complete cycles.',
      'Use 360° vision to inspect the matching motion before upload.',
    ],
    stats: [
      { label: 'Templates', value: '05' },
      { label: 'Cadence', value: 'Live' },
      { label: 'Review', value: '2D' },
    ],
  },
  training: {
    eyebrow: 'Basic Training Lab',
    titleLead: 'Coach each',
    titleAccent: 'training rep',
    description:
      'A more deliberate upload and review flow for conditioning work, with reserved space for future template demos like squats, planks, and high knees.',
    accentText: 'text-emerald-300',
    accentBorder: 'border-emerald-400/20',
    accentSurface: 'from-emerald-500/18 via-slate-950 to-slate-950',
    accentGlow: 'bg-emerald-400/18',
    accentBar: 'bg-emerald-300',
    accentButton:
      'border-emerald-300/30 bg-emerald-300 text-slate-950 hover:bg-emerald-200',
    accentButtonMuted:
      'border-emerald-300/18 bg-emerald-300/10 text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-300/16',
    sampleLabel: 'Side-view training template',
    sampleTitle: 'Example movement preview placeholder',
    sampleDescription:
      'Future template demos can appear here for squat, wall sit, plank, and running mechanics so users know the expected angle before upload.',
    templates: ['High Knees', 'Wall Sit', 'Deep Squat'],
    guide: [
      'Side view usually works best for posture-based training checks.',
      'Keep the athlete centered with full body visibility.',
      'Template switching UI is ready for hookup when you need it.',
    ],
    stats: [
      { label: 'Templates', value: '05' },
      { label: 'Camera', value: 'Side' },
      { label: 'Session', value: 'Ready' },
    ],
  },
};

const navItems = [
  { key: 'shooting' as const, href: routes.pose2d.shooting, label: 'Shooting' },
  { key: 'dribbling' as const, href: routes.pose2d.dribbling, label: 'Dribbling' },
  { key: 'training' as const, href: routes.pose2d.training, label: 'Training' },
];

export default function PoseWorkspaceShell({
  mode,
  hasUpload,
  children,
}: PoseWorkspaceShellProps) {
  const config = modeConfig[mode];
  const isInteractiveDribblingMode = mode === 'dribbling';
  const [selectedDribblingDemoId, setSelectedDribblingDemoId] = React.useState(
    dribblingTemplateDemos[0]?.id ?? ''
  );
  const [showZoomInDemo, setShowZoomInDemo] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'dribbling') {
      setShowZoomInDemo(false);
      return;
    }

    setSelectedDribblingDemoId(dribblingTemplateDemos[0]?.id ?? '');
    setShowZoomInDemo(false);
  }, [mode]);

  const selectedDribblingDemo = isInteractiveDribblingMode
    ? dribblingTemplateDemos.find((template) => template.id === selectedDribblingDemoId) ??
      dribblingTemplateDemos[0]
    : null;

  const activeDribblingVideoSrc = selectedDribblingDemo
    ? showZoomInDemo && selectedDribblingDemo.zoomSrc
      ? selectedDribblingDemo.zoomSrc
      : selectedDribblingDemo.demoSrc
    : null;

  const activeDribblingDescription = selectedDribblingDemo
    ? showZoomInDemo
      ? selectedDribblingDemo.zoomDescription ?? selectedDribblingDemo.demoDescription
      : selectedDribblingDemo.demoDescription
    : '';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080b] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_58%)]" />
      <div
        className={cn(
          'pointer-events-none absolute left-[-10rem] top-24 h-72 w-72 rounded-full blur-3xl',
          config.accentGlow
        )}
      />
      <div className="pointer-events-none absolute right-[-12rem] top-64 h-80 w-80 rounded-full bg-white/6 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="analysis-surface overflow-hidden rounded-[30px] border border-white/10 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-[var(--font-display)] text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-white/45">
                  AI Hoops Motion Studio
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {navItems.map((item) => {
                    const active = item.key === mode;

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={cn(
                          'inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 sm:px-5',
                          active
                            ? config.accentButton
                            : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/20 hover:bg-white/[0.08]'
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  <Link
                    href={routes.pose2d.report}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] sm:px-5"
                  >
                    Report
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:w-fit">
                {config.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={cn(
                      'rounded-2xl border bg-white/[0.04] px-4 py-3 text-left backdrop-blur-sm',
                      config.accentBorder
                    )}
                  >
                    <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/45">
                      {stat.label}
                    </div>
                    <div
                      className={cn(
                        'mt-2 font-[var(--font-display)] text-lg font-semibold',
                        config.accentText
                      )}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
              <div className="max-w-3xl">
                <div
                  className={cn(
                    'font-[var(--font-display)] text-[0.72rem] font-semibold uppercase tracking-[0.34em]',
                    config.accentText
                  )}
                >
                  {config.eyebrow}
                </div>
                <h1 className="mt-4 font-[var(--font-display)] text-[clamp(2.6rem,7vw,5.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.07em] text-white">
                  {config.titleLead}{' '}
                  <span className={config.accentText}>{config.titleAccent}</span>
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
                  {config.description}
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-white',
                      config.accentBorder
                    )}
                  >
                    <Sparkles className={cn('h-5 w-5', config.accentText)} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Template-linked demo area
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Users can pick a template and see the matched example motion here before
                      uploading their own clip.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div
            className={cn(
              'analysis-surface overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br',
              config.accentSurface
            )}
          >
            <div className="analysis-grid relative min-h-[320px] overflow-hidden sm:min-h-[360px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.13),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08),transparent_24%)]" />
              <div className="relative flex h-full flex-col justify-between p-5 sm:p-6 lg:p-7">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.28em] text-white/70 backdrop-blur-md">
                    <MonitorPlay className="h-3.5 w-3.5" />
                    {selectedDribblingDemo
                      ? `${selectedDribblingDemo.viewLabel} dribble template`
                      : config.sampleLabel}
                  </div>
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.28em] backdrop-blur-md',
                      config.accentBorder,
                      config.accentText
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    {selectedDribblingDemo
                      ? showZoomInDemo
                        ? '360° vision'
                        : selectedDribblingDemo.motionLabel
                      : 'Placeholder demo'}
                  </div>
                </div>

                {selectedDribblingDemo && activeDribblingVideoSrc ? (
                  <div className="grid flex-1 gap-6">
                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
                      <video
                        key={activeDribblingVideoSrc}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full bg-black object-contain"
                      >
                        <source src={activeDribblingVideoSrc} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>

                    <div className="max-w-2xl">
                      <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/45">
                        {selectedDribblingDemo.label} / {selectedDribblingDemo.viewLabel}
                      </div>
                      <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                        {showZoomInDemo
                          ? `${selectedDribblingDemo.motionLabel} 360° vision`
                          : `${selectedDribblingDemo.label} Demo`}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
                        {activeDribblingDescription}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-xl">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/10 backdrop-blur-xl transition-transform duration-300 hover:scale-105">
                      <MonitorPlay className={cn('h-8 w-8', config.accentText)} />
                    </div>
                    <h2 className="mt-5 font-[var(--font-display)] text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                      {config.sampleTitle}
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-7 text-white/62 sm:text-base">
                      {config.sampleDescription}
                    </p>
                  </div>
                )}

                <div className="rounded-[24px] border border-white/10 bg-black/26 p-4 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/40">
                        Preview controls
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10">
                          <MonitorPlay className="h-5 w-5 text-white" />
                        </div>
                        {selectedDribblingDemo ? (
                          <div className="text-sm text-white/60">
                            {showZoomInDemo
                              ? `Playing shared ${selectedDribblingDemo.motionLabel.toLowerCase()} zoom-in clip`
                              : `Playing ${selectedDribblingDemo.viewLabel.toLowerCase()} demo clip`}
                          </div>
                        ) : (
                          <div className="h-1.5 w-24 rounded-full bg-white/15 sm:w-40">
                            <div className={cn('h-full rounded-full', config.accentBar)} />
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedDribblingDemo ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedDribblingDemo.zoomSrc) {
                            return;
                          }

                          setShowZoomInDemo((current) => !current);
                        }}
                        aria-pressed={showZoomInDemo}
                        disabled={!selectedDribblingDemo.zoomSrc}
                        className={cn(
                          'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/35',
                          showZoomInDemo ? config.accentButton : config.accentButtonMuted
                        )}
                      >
                        {showZoomInDemo ? 'Back to Template Demo' : '360° vision'}
                        <MoveRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 text-sm text-white/60">
                        Template switch placeholder
                        <MoveRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="analysis-surface rounded-[30px] border border-white/10 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-[var(--font-display)] text-[0.68rem] uppercase tracking-[0.3em] text-white/42">
                    Template list
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Select a demo template
                  </h3>
                </div>
                <div
                  className={cn(
                    'rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em]',
                    config.accentBorder,
                    config.accentText
                  )}
                >
                  {isInteractiveDribblingMode ? 'Live demo' : 'Placeholder'}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {isInteractiveDribblingMode
                  ? dribblingTemplateDemos.map((template) => {
                      const isActive = template.id === selectedDribblingDemo?.id;

                      return (
                        <button
                          key={template.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            setSelectedDribblingDemoId(template.id);
                            setShowZoomInDemo(false);
                          }}
                          className={cn(
                            'flex min-h-16 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                            isActive
                              ? cn(
                                  config.accentButtonMuted,
                                  'shadow-[0_12px_30px_rgba(15,23,42,0.25)]'
                                )
                              : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:bg-white/[0.06]'
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-white">{template.label}</span>
                            <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.24em] text-white/45">
                              {template.viewLabel}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs uppercase tracking-[0.24em] text-white/45">
                            {isActive ? 'Active' : 'Demo'}
                          </span>
                        </button>
                      );
                    })
                  : config.templates.map((template, index) => (
                      <button
                        key={template}
                        type="button"
                        className={cn(
                          'flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                          index === 0
                            ? cn(
                                config.accentButtonMuted,
                                'shadow-[0_12px_30px_rgba(15,23,42,0.25)]'
                              )
                            : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:bg-white/[0.06]'
                        )}
                      >
                        <span className="font-medium">{template}</span>
                        <span className="text-xs uppercase tracking-[0.24em] text-white/45">
                          Demo
                        </span>
                      </button>
                    ))}
              </div>
            </div>

            <div className="analysis-surface rounded-[30px] border border-white/10 p-5 sm:p-6">
              <div className="font-[var(--font-display)] text-[0.68rem] uppercase tracking-[0.3em] text-white/42">
                Upload guide
              </div>
              <div className="mt-3 text-lg font-semibold text-white">Keep the flow simple</div>

              <div className="mt-5 grid gap-3">
                {config.guide.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <CheckCircle2
                      className={cn('mt-0.5 h-4 w-4 shrink-0', config.accentText)}
                    />
                    <p className="text-sm leading-6 text-white/62">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="analysis-surface rounded-[32px] border border-white/10 p-4 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-[var(--font-display)] text-[0.68rem] uppercase tracking-[0.3em] text-white/42">
                Workspace
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {hasUpload ? 'Analysis session' : 'Upload your clip'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                {hasUpload
                  ? 'The analysis surface keeps your video, timeline controls, and live metrics in a cleaner two-column layout that also collapses well on mobile.'
                  : 'Upload stays in the same workspace below the template preview so the page feels more guided before analysis begins.'}
              </p>
            </div>

            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[0.72rem] uppercase tracking-[0.28em]',
                config.accentBorder,
                config.accentText
              )}
            >
              {hasUpload ? 'Session loaded' : 'Awaiting upload'}
            </div>
          </div>

          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
