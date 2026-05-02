"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
} from "lucide-react";

import { normalizeAuthRole, resolveLoginRedirect } from "@/lib/authRedirect";
import { routes } from "@/lib/routes";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

type LoginMode = "password" | "phone" | "email";

const loginTabs: Array<{ value: LoginMode; label: string }> = [
  { value: "password", label: "Account" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuACQ5vruTNWYcUakJXGSrvRP6pqhZeTpwWP8aBveh5wi3g9srP-Vt6b5wJqiksIhwKTaveGJYz5mobDZc05uF5PhIROT3_VHK5oFjC-fp_XzWVg6Q_Vvwm1yWdA_llgVW5Jt3oMJ2B_ILNJrttdf4FXWfvGcnHPeKv7kJFWgFUTQFgLu4MPFgZADV1_0hIVFHF-O8O2za9zPKEhzDgTy6jiQKXaV71iMEkMguQEqFwIF12oHZx8ekkQrI8nk8yGnBJcdx7kp6zCRvmo";

function FieldLabel({
  htmlFor,
  children,
  action,
}: {
  htmlFor: string;
  children: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-4 pl-1">
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/52"
      >
        {children}
      </label>
      {action}
    </div>
  );
}

function InputShell({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-black/42 px-4 py-3.5 transition duration-300 focus-within:border-[#ff9f4a]/60 focus-within:bg-black/58 focus-within:shadow-[0_0_0_2px_rgba(255,159,74,0.16)]">
      <span className="text-white/42 transition-colors group-focus-within:text-[#ff9f4a]">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const [mode, setMode] = useState<LoginMode>("password");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    username: "",
    password: "",
  });
  const [phoneForm, setPhoneForm] = useState({
    phone_number: "",
    password: "",
  });
  const [emailForm, setEmailForm] = useState({
    email: "",
    code: "",
  });
  const [emailSendLabel, setEmailSendLabel] = useState("Send");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSendingEmail, startSendingEmail] = useTransition();

  const handleLogin = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const session =
          mode === "password"
            ? await authService.loginWithPassword(passwordForm)
            : mode === "phone"
              ? await authService.loginWithPhonePassword(phoneForm)
              : await authService.loginWithEmailCode(emailForm);

        const normalizedRole = normalizeAuthRole(session.user.role);
        const normalizedSession = {
          ...session,
          user: {
            ...session.user,
            role: normalizedRole,
          },
        };
        setSession(normalizedSession);
        const nextPath = searchParams.get("next");
        const redirectPath = resolveLoginRedirect(normalizedRole, nextPath);
        setSuccess("Signed in. Redirecting to your workspace.");
        router.replace(redirectPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to sign in.");
      }
    });
  };

  const handleSendEmailCode = () => {
    setError(null);
    setSuccess(null);

    startSendingEmail(async () => {
      try {
        const response = await authService.sendEmailLoginCode({
          email: emailForm.email,
        });
        setEmailSendLabel(`${response.data.expire_seconds}s`);
        setSuccess(
          response.data.debug_code
            ? `Email code sent. Development debug code: ${response.data.debug_code}`
            : `Email code request accepted for ${response.data.target}.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to send email code.");
      }
    });
  };

  return (
    <main
      className="min-h-screen bg-[#0e0e0e] px-5 py-8 text-white sm:px-8 lg:px-10"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(14,14,14,0.84), rgba(14,14,14,0.78), rgba(14,14,14,0.92)), url(${heroImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-4xl font-black uppercase tracking-[-0.08em] text-[#ff9f4a] sm:text-5xl">
            IFSPORT AI CLUB
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-white/56">
            Performance Lab Access
          </p>
        </div>

        <div className="mx-auto w-full max-w-[440px] rounded-[2rem] bg-gradient-to-br from-[#ff9f4a] via-[#ff7162] to-[#ff9f4a] p-px shadow-[0_0_50px_rgba(255,159,74,0.14)]">
          <section className="rounded-[calc(2rem-1px)] border border-[#ff9f4a]/12 bg-[rgba(14,14,14,0.9)] px-6 py-8 backdrop-blur-xl sm:px-8 sm:py-10">
            <header className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
              <p className="mt-2 text-sm font-medium text-white/60">
                Enter your credentials to access your session analysis.
              </p>
            </header>

            <div className="mb-6 grid grid-cols-3 gap-2 rounded-full bg-[#191a1a]/90 p-1">
              {loginTabs.map((option) => {
                const active = option.value === mode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={`rounded-full px-3 py-2.5 text-xs font-bold uppercase tracking-[0.22em] transition ${
                      active
                        ? "bg-gradient-to-br from-[#ff9f4a] to-[#ff7162] text-[#442100] shadow-[0_0_20px_rgba(255,159,74,0.25)]"
                        : "text-white/54 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                handleLogin();
              }}
            >
              {mode === "password" ? (
                <>
                  <div>
                    <FieldLabel htmlFor="username">Athlete Identifier</FieldLabel>
                    <InputShell icon={<UserRound className="h-5 w-5" />}>
                      <input
                        id="username"
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                        placeholder="elton"
                        value={passwordForm.username}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                      />
                    </InputShell>
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="password"
                      action={
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ff9f4a]">
                          Password login
                        </span>
                      }
                    >
                      Security Key
                    </FieldLabel>
                    <InputShell icon={<Lock className="h-5 w-5" />}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="w-full bg-transparent text-sm text-white outline-none shadow-none placeholder:text-white/26"
                        placeholder="Enter your password"
                        value={passwordForm.password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="text-white/48 transition hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </InputShell>
                  </div>
                </>
              ) : null}

              {mode === "phone" ? (
                <>
                  <div>
                    <FieldLabel htmlFor="phone_number">Athlete Phone</FieldLabel>
                    <InputShell icon={<Smartphone className="h-5 w-5" />}>
                      <input
                        id="phone_number"
                        className="w-full bg-transparent text-sm text-white outline-none shadow-none placeholder:text-white/26"
                        placeholder="0413756205"
                        value={phoneForm.phone_number}
                        onChange={(event) =>
                          setPhoneForm((current) => ({
                            ...current,
                            phone_number: event.target.value,
                          }))
                        }
                      />
                    </InputShell>
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="phone_password"
                      action={
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ff9f4a]">
                          Password login
                        </span>
                      }
                    >
                      Phone Password
                    </FieldLabel>
                    <InputShell icon={<Lock className="h-5 w-5" />}>
                      <input
                        id="phone_password"
                        type={showPhonePassword ? "text" : "password"}
                        className="w-full bg-transparent text-sm text-white outline-none shadow-none placeholder:text-white/26"
                        placeholder="Enter your password"
                        value={phoneForm.password}
                        onChange={(event) =>
                          setPhoneForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPhonePassword((current) => !current)}
                        className="text-white/48 transition hover:text-white"
                        aria-label={showPhonePassword ? "Hide password" : "Show password"}
                      >
                        {showPhonePassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </InputShell>
                  </div>
                </>
              ) : null}

              {mode === "email" ? (
                <>
                  <div>
                    <FieldLabel htmlFor="email">Athlete Email</FieldLabel>
                    <InputShell icon={<Mail className="h-5 w-5" />}>
                      <input
                        id="email"
                        type="email"
                        className="w-full bg-transparent text-sm text-white outline-none shadow-none placeholder:text-white/26"
                        placeholder="athlete@performance.lab"
                        value={emailForm.email}
                        onChange={(event) =>
                          setEmailForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                    </InputShell>
                  </div>

                  <div>
                    <FieldLabel htmlFor="email_code">Email Verification</FieldLabel>
                    <InputShell icon={<ShieldCheck className="h-5 w-5" />}>
                      <input
                        id="email_code"
                        className="w-full bg-transparent text-sm text-white outline-none shadow-none placeholder:text-white/26"
                        placeholder="Enter the verification code"
                        value={emailForm.code}
                        onChange={(event) =>
                          setEmailForm((current) => ({
                            ...current,
                            code: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={handleSendEmailCode}
                        disabled={isSendingEmail}
                        className="rounded-full border border-[#ff9f4a]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff9f4a] transition hover:border-[#ff9f4a] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isSendingEmail ? "Sending" : emailSendLabel}
                      </button>
                    </InputShell>
                  </div>
                </>
              ) : null}

              <label className="flex items-center gap-2 pl-1 text-xs font-medium text-white/60">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/50 text-[#ff9f4a] focus:ring-[#ff9f4a]"
                />
                Stay synced on this device
              </label>

              {error ? (
                <p className="rounded-2xl border border-[#ff7351]/30 bg-[#b92902]/16 px-4 py-3 text-sm text-[#ffd2c8]">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="rounded-2xl border border-[#ff9f4a]/20 bg-[#ff9f4a]/10 px-4 py-3 text-sm text-[#ffe393]">
                  {success}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#ff9f4a] to-[#ff7162] py-4 text-sm font-black uppercase tracking-[0.22em] text-[#532a00] transition duration-300 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(255,159,74,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {isPending
                    ? "Securing..."
                    : mode === "password"
                      ? "Secure Login"
                      : mode === "phone"
                        ? "Phone Login"
                        : "Email Login"}
                </span>
                <Sparkles className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-8 border-t border-white/8 pt-6">
              <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">
                Alternate Access
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1f2020]/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white/70 opacity-70"
                >
                  <Mail className="h-4 w-4" />
                  Google Soon
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1f2020]/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white/70 opacity-70"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Apple Soon
                </button>
              </div>
            </div>

            <footer className="mt-8 text-center text-sm text-white/56">
              Apply for Membership:
              <Link
                href={routes.auth.register}
                className="ml-1 font-bold text-[#ff9f4a] underline-offset-4 transition hover:underline"
              >
                Register
              </Link>
            </footer>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 px-2 text-center sm:gap-8">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">
              98.2<span className="text-xs text-[#ff7162]">%</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/48">
              Accuracy Rate
            </span>
          </div>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">
              2.4<span className="text-xs text-[#ff9f4a]">M</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/48">
              Shots Analyzed
            </span>
          </div>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">
              500<span className="text-xs text-[#ffe393]">+</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/48">
              Pro Athletes
            </span>
          </div>
        </div>

        <div className="mt-8 flex justify-center sm:justify-end">
          <Link
            href={routes.pose2d.main}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1f2020]/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9f4a] transition hover:border-[#ff9f4a]/40 hover:text-white"
          >
            Studio Access
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
