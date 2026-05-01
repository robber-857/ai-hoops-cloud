"use client";

import { useCallback, useRef, type MutableRefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  RadioTower,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Group, Points } from "three";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

type PointerState = {
  x: number;
  y: number;
};

type CoachShellProps = {
  children: React.ReactNode;
  user: AuthUser;
  title: string;
  breadcrumb: string[];
};

const navItems = [
  {
    href: routes.coach.home,
    label: "Console",
    icon: LayoutDashboard,
  },
  {
    href: routes.coach.home,
    label: "Classes",
    icon: UsersRound,
  },
  {
    href: routes.coach.home,
    label: "Reports",
    icon: BarChart3,
  },
  {
    href: routes.coach.home,
    label: "Tasks",
    icon: ClipboardList,
  },
];

function DataParticleField({ pointerRef }: { pointerRef: MutableRefObject<PointerState> }) {
  const pointsRef = useRef<Points>(null);
  const positions = useRef<Float32Array | null>(null);

  if (!positions.current) {
    const total = 420;
    const buffer = new Float32Array(total * 3);
    for (let index = 0; index < total; index += 1) {
      const stride = index * 3;
      buffer[stride] = (Math.random() - 0.5) * 16;
      buffer[stride + 1] = (Math.random() - 0.5) * 8;
      buffer[stride + 2] = (Math.random() - 0.5) * 12;
    }
    positions.current = buffer;
  }

  useFrame(({ clock }) => {
    if (!pointsRef.current) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    pointsRef.current.rotation.y = elapsed * 0.018 + pointerRef.current.x * 0.08;
    pointsRef.current.rotation.x = pointerRef.current.y * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#65f7ff"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

function WireBasketball({ pointerRef }: { pointerRef: MutableRefObject<PointerState> }) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    groupRef.current.rotation.y = elapsed * 0.23 + pointerRef.current.x * 0.36;
    groupRef.current.rotation.x = 0.18 + pointerRef.current.y * 0.18;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.45}>
      <group ref={groupRef} position={[2.8, -0.2, -1.2]} scale={1.2}>
        <mesh>
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial color="#38f8ff" wireframe transparent opacity={0.42} />
        </mesh>
        {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation) => (
          <mesh key={rotation} rotation={[Math.PI / 2, 0, rotation]}>
            <torusGeometry args={[1.02, 0.01, 8, 96]} />
            <meshBasicMaterial color="#d8ff5d" transparent opacity={0.68} />
          </mesh>
        ))}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.02, 0.008, 8, 96]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

function CoachScene({ pointerRef }: { pointerRef: MutableRefObject<PointerState> }) {
  useFrame(({ camera }) => {
    camera.position.x += (pointerRef.current.x * 0.45 - camera.position.x) * 0.035;
    camera.position.y += (-pointerRef.current.y * 0.26 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.72} />
      <pointLight position={[3, 4, 2]} intensity={2.2} color="#65f7ff" />
      <pointLight position={[-4, -1, -2]} intensity={1.6} color="#d8ff5d" />
      <DataParticleField pointerRef={pointerRef} />
      <WireBasketball pointerRef={pointerRef} />
      <gridHelper args={[18, 18, "#38f8ff", "#1f2937"]} position={[0, -2.4, 0]} />
    </>
  );
}

function CoachBackground({ pointerRef }: { pointerRef: MutableRefObject<PointerState> }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(56,248,255,0.16),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(216,255,93,0.1),transparent_24%),radial-gradient(circle_at_46%_92%,rgba(167,139,250,0.16),transparent_28%),linear-gradient(135deg,#030712_0%,#07111d_42%,#05070c_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-28" />
      <Canvas
        camera={{ position: [0, 0.5, 6], fov: 48 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <CoachScene pointerRef={pointerRef} />
      </Canvas>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.22)_0%,rgba(3,7,18,0.62)_72%,#030712_100%)]" />
      <div className="coach-scanline absolute inset-0 opacity-40" />
    </div>
  );
}

export function CoachShell({ children, user, title, breadcrumb }: CoachShellProps) {
  const pathname = usePathname();
  const pointerRef = useRef<PointerState>({ x: 0, y: 0 });

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    pointerRef.current = {
      x: event.clientX / window.innerWidth - 0.5,
      y: event.clientY / window.innerHeight - 0.5,
    };
  }, []);

  const username = user.nickname?.trim() || user.username;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#030712] text-white"
      onPointerMove={handlePointerMove}
    >
      <CoachBackground pointerRef={pointerRef} />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] border-r border-white/10 bg-[#07111d]/58 px-4 py-5 shadow-[18px_0_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:block">
        <Link href={routes.coach.home} className="flex items-center gap-3 px-2">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#65f7ff]/30 bg-[#65f7ff]/12 text-[#d8ff5d] shadow-[0_0_24px_rgba(101,247,255,0.18)]">
            <RadioTower className="h-5 w-5" />
            <span className="absolute inset-0 rounded-2xl border border-[#d8ff5d]/18 blur-[2px]" />
          </span>
          <span>
            <span className="block font-[var(--font-display)] text-lg font-bold tracking-[0.04em] text-white drop-shadow-[0_0_12px_rgba(101,247,255,0.36)]">
              AI Hoops
            </span>
            <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#65f7ff]/70">
              Coach Ops
            </span>
          </span>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              index === 0
                ? pathname === item.href
                : item.label === "Classes" && pathname.startsWith("/coach/classes");

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "group relative flex min-h-12 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-semibold transition",
                  isActive ? "text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="coach-sidebar-active"
                    className="absolute inset-0 rounded-lg border border-[#65f7ff]/22 bg-[#65f7ff]/10"
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  />
                ) : null}
                {isActive ? (
                  <motion.span
                    layoutId="coach-sidebar-rail"
                    className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-[#d8ff5d] shadow-[0_0_18px_rgba(216,255,93,0.7)]"
                  />
                ) : null}
                <Icon className="relative h-4 w-4 text-[#65f7ff]" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8ff5d]/28 bg-[#d8ff5d]/12 font-semibold text-[#d8ff5d]">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{username}</span>
              <span className="block text-[0.68rem] uppercase tracking-[0.2em] text-white/45">
                {user.role}
              </span>
            </span>
          </div>
        </div>
      </aside>

      <section className="relative z-10 lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#030712]/62 backdrop-blur-2xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/46">
                <span>Coach</span>
                {breadcrumb.map((item) => (
                  <span key={item} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-[#65f7ff]/60" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
              <h1 className="mt-1 truncate font-[var(--font-display)] text-lg font-bold tracking-[0.02em] text-white drop-shadow-[0_0_14px_rgba(101,247,255,0.28)] sm:text-xl">
                {title}
              </h1>
            </div>

            <div className="coach-breathing-bar hidden min-w-[15rem] items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 backdrop-blur-xl sm:flex">
              <span className="flex items-center gap-2 text-xs font-medium text-white/72">
                <Activity className="h-4 w-4 text-[#d8ff5d]" />
                Live control surface
              </span>
              <span className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[#65f7ff]/76">
                <ShieldCheck className="h-4 w-4" />
                {user.role}
              </span>
            </div>
          </div>
        </header>

        <div className="relative mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </section>
    </main>
  );
}
