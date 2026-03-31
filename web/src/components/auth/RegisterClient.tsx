"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Activity, Bolt, Eye, EyeOff, Trophy, UserPlus } from "lucide-react";

import { routes } from "@/lib/routes";
import { authService } from "@/services/auth";

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAhAEgFtYwa5E1isqY7o_mbbkDBhBpP9CVlVih9nT7kVh7G4tF_h-oIrryUDjS8h6ABMqQ9D-1id9BGpmp8obwBz74vZNAuEXIzO3PANwmaWdw2AFOKzhDIzHV6sk2SvL50S_3WgARZtksYD0LQxIUPuo5Xa-rh6Wuf1ltvwkqa_loQya9pkWksy6v50Yk_9DcetY9yEuwqtOA8mq8QfqS9W9LMjIjoy3PQt44veK4sn6aIH5y5y0HkF9r9iALngA-40U0NvF5ztwFO";

function FormLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-bold uppercase tracking-[0.22em] text-white/52"
    >
      {children}
    </label>
  );
}

function StatRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-xl border border-white/10 bg-[#262626]/80 p-3 text-[#ff9f4a]">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold uppercase tracking-tight text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/62">{description}</p>
      </div>
    </div>
  );
}

export function RegisterClient() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirm_password: "",
    phone_number: "",
    phone_code: "",
    email: "",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isSendingPhoneCode, startSendingPhoneCode] = useTransition();

  const handleSendPhoneCode = () => {
    setError(null);
    setStatusMessage(null);

    startSendingPhoneCode(async () => {
      try {
        const response = await authService.sendRegisterCode({
          phone_number: form.phone_number,
          email: form.email || undefined,
        });
        setForm((current) => ({
          ...current,
          phone_code: "1234",
        }));
        setStatusMessage(
          `Verification request accepted for ${response.data.target}. Temporary local test phone code 1234 has been filled in for you.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to send verification code.");
      }
    });
  };

  const handleRegister = () => {
    setError(null);
    setStatusMessage(null);

    if (!agreed) {
      setError("Please accept the terms to continue.");
      return;
    }

    startSubmitting(async () => {
      try {
        await authService.register({
          username: form.username,
          password: form.password,
          confirm_password: form.confirm_password,
          phone_number: form.phone_number,
          phone_code: form.phone_code,
          email: form.email || undefined,
        });
        setStatusMessage("Registration complete. Redirecting to sign in.");
        router.push(routes.auth.login);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to create account.");
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        <section className="relative flex min-h-[420px] w-full items-center justify-center overflow-hidden md:min-h-screen md:w-1/2">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(14,14,14,0.7), rgba(14,14,14,0.2), transparent), linear-gradient(to top, rgba(14,14,14,0.92), rgba(14,14,14,0.24), transparent), url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute left-[-4rem] top-1/4 h-72 w-72 rounded-full bg-[#ff9f4a]/20 blur-[120px]" />
          <div className="absolute bottom-1/4 right-[-4rem] h-72 w-72 rounded-full bg-[#ff7162]/20 blur-[120px]" />

          <div className="relative z-10 max-w-xl px-8 py-14 md:px-12 lg:px-16">
            <div className="mb-12">
              <span className="mb-3 block text-xl font-black uppercase italic tracking-[-0.08em] text-[#ff9f4a]">
                AI Hoops
              </span>
              <h1 className="text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] text-white sm:text-6xl lg:text-7xl">
                Join the <br />
                <span className="text-[#ff9f4a] [text-shadow:0_0_20px_rgba(255,159,74,0.4)]">
                  Elite
                </span>
              </h1>
            </div>

            <div className="space-y-8">
              <StatRow
                icon={<Activity className="h-5 w-5" />}
                title="Pro-Grade Analysis"
                description="Real-time biomechanical feedback on every shot you take."
              />
              <StatRow
                icon={<Bolt className="h-5 w-5" />}
                title="Kinetic Precision"
                description="Optimize your release speed and arc with AI-driven insights."
              />
              <StatRow
                icon={<Trophy className="h-5 w-5" />}
                title="Global Leaderboards"
                description="Compare your metrics with pro athletes and local legends."
              />
            </div>
          </div>
        </section>

        <section className="relative flex w-full items-center justify-center px-6 py-10 md:w-1/2 md:px-12 lg:px-20">
          <div className="absolute right-0 top-0 h-64 w-64 bg-[#ff9f4a]/5 blur-[100px]" />

          <div className="w-full max-w-md space-y-8">
            <div className="rounded-[1.35rem] border border-white/10 bg-[rgba(31,32,32,0.6)] p-8 shadow-2xl backdrop-blur-2xl md:p-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white">Create Account</h2>
                <p className="mt-2 text-white/60">Elevate your game to the next dimension.</p>
              </div>

              <form
                className="space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRegister();
                }}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormLabel htmlFor="username">Username</FormLabel>
                    <input
                      id="username"
                      className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                      placeholder="elton"
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="phone_number">Phone Number</FormLabel>
                    <input
                      id="phone_number"
                      className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                      placeholder="0413756205"
                      value={form.phone_number}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone_number: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="email">Email Address</FormLabel>
                  <input
                    id="email"
                    type="email"
                    className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                    placeholder="athlete@performance.lab"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="password">Create Password</FormLabel>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 pr-12 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="confirm_password">Confirm Password</FormLabel>
                  <div className="relative">
                    <input
                      id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 pr-12 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                      placeholder="••••••••"
                      value={form.confirm_password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          confirm_password: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel htmlFor="phone_code">Phone Verification Code</FormLabel>
                    <button
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={isSendingPhoneCode}
                      className="rounded-full border border-[#ff9f4a]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff9f4a] transition hover:border-[#ff9f4a] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSendingPhoneCode ? "Sending" : "Send code"}
                    </button>
                  </div>
                  <input
                    id="phone_code"
                    className="w-full rounded-xl border border-white/10 bg-[#000000] px-4 py-3 text-white placeholder:text-neutral-600 transition focus:border-[#ff9f4a] focus:outline-none focus:ring-1 focus:ring-[#ff9f4a]"
                    placeholder="Use 1234 for local testing"
                    value={form.phone_code}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone_code: event.target.value }))
                    }
                  />
                </div>

                <div className="flex items-start gap-3 py-1">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-[#000000] text-[#ff9f4a] focus:ring-[#ff9f4a]"
                  />
                  <label htmlFor="terms" className="text-xs leading-tight text-white/58">
                    I agree to the{" "}
                    <span className="text-[#ff9f4a] hover:underline">Terms of Service</span> and{" "}
                    <span className="text-[#ff9f4a] hover:underline">Privacy Policy</span>.
                  </label>
                </div>

                {error ? (
                  <p className="rounded-2xl border border-[#ff7351]/30 bg-[#b92902]/16 px-4 py-3 text-sm text-[#ffd2c8]">
                    {error}
                  </p>
                ) : null}
                {statusMessage ? (
                  <p className="rounded-2xl border border-[#ff9f4a]/20 bg-[#ff9f4a]/10 px-4 py-3 text-sm text-[#ffe393]">
                    {statusMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-gradient-to-br from-[#ff9f4a] to-[#fd8b00] py-4 text-sm font-black uppercase tracking-[0.22em] text-[#442100] transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,159,74,0.3)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Initializing..." : "Initialize Training"}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-neutral-600">
                  <span className="bg-[rgba(31,32,32,0.9)] px-3">Sync With Pro ID</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/72 transition-colors hover:bg-white/5"
                >
                  <UserPlus className="h-4 w-4" />
                  Google
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/72 transition-colors hover:bg-white/5"
                >
                  <Trophy className="h-4 w-4" />
                  Apple
                </button>
              </div>
            </div>

            <div className="text-center text-sm text-white/58">
              Already in the program?
              <Link href={routes.auth.login} className="ml-1 font-bold text-[#ff9f4a] hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/8 bg-[#0a0a0a] px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">
          <div className="text-lg font-bold uppercase italic text-neutral-100">AI HOOPS</div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500">
            <span className="transition-colors hover:text-[#ff9f4a]">Privacy Policy</span>
            <span className="transition-colors hover:text-[#ff9f4a]">Terms of Service</span>
            <span className="transition-colors hover:text-[#ff9f4a]">Support</span>
          </div>
          <div className="text-center text-xs uppercase tracking-[0.14em] text-neutral-500 md:text-right">
            © 2024 AI HOOPS PERFORMANCE LAB
          </div>
        </div>
      </footer>
    </main>
  );
}
