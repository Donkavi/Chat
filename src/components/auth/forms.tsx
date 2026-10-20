"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AtSign, Check, Loader2, Mail, MailCheck, X, KeyRound, CircleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";
import { useUsernameCheck } from "@/components/hooks/use-username-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Errors = Record<string, string>;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const e: Errors = {};
  for (const i of issues) e[String(i.path[0])] ??= i.message;
  return e;
}

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/discover";
}

function FormHeader({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2rem]">{title}</h1>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">{subtitle}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium",
        tone === "error" ? "bg-danger-soft text-danger" : "bg-violet-soft text-ink",
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </motion.div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [values, setValues] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await api.post("/api/auth/login", parsed.data);
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't sign you in.");
      setBusy(false);
    }
  };

  return (
    <>
      <FormHeader
        title="Welcome back"
        subtitle={
          <>
            New to Lumos?{" "}
            <Link href="/register" className="font-semibold text-primary-ink hover:underline">
              Create an account
            </Link>
          </>
        }
      />
      {params.get("expired") && !formError && <Banner tone="info">Your session ended. Please sign in again.</Banner>}
      {params.get("reset") && !formError && <Banner tone="info">Password updated — sign in with your new password.</Banner>}
      {formError && <Banner tone="error">{formError}</Banner>}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Input
          label="Email or username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={values.identifier}
          onChange={(e) => setValues((v) => ({ ...v, identifier: e.target.value }))}
          error={errors.identifier}
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password}
          trailingLabel={
            <Link href="/forgot-password" className="text-[0.8125rem] font-semibold text-primary-ink hover:underline">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </>
  );
}

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function StrengthMeter({ password }: { password: string }) {
  const s = passwordStrength(password);
  const label = ["Too short", "Weak", "Okay", "Good", "Strong"][s];
  if (!password) return null;
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= s ? (s <= 1 ? "bg-danger" : s === 2 ? "bg-warning" : "bg-online") : "bg-surface-3",
            )}
          />
        ))}
      </div>
      <span className="w-16 text-right text-xs font-medium text-ink-muted">{label}</span>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({ displayName: "", username: "", email: "", password: "", confirmAdult: false });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const usernameState = useUsernameCheck(values.username);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  // Suggest a username from the display name until the user edits it themselves.
  const setDisplayName = (name: string) => {
    set("displayName", name);
    if (usernameTouched) return;
    const suggestion = name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    setValues((s) => ({ ...s, username: suggestion }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setBusy(true);
    try {
      await api.post("/api/auth/register", parsed.data);
      router.replace("/profile?welcome=1");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setFormError(err instanceof Error ? err.message : "Couldn't create your account.");
      setBusy(false);
    }
  };

  return (
    <>
      <FormHeader
        title="Create your account"
        subtitle={
          <>
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-primary-ink hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      {formError && <Banner tone="error">{formError}</Banner>}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Input label="Your name" autoComplete="name" maxLength={40} value={values.displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} autoFocus />
        <Input
          label="Username"
          leading={<AtSign className="size-4" />}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          value={values.username}
          onChange={(e) => {
            setUsernameTouched(true);
            set("username", e.target.value.toLowerCase());
          }}
          error={errors.username || (usernameState === "taken" ? "That username is taken." : undefined)}
          trailing={
            usernameState === "checking" ? (
              <Loader2 className="size-4 animate-spin text-ink-subtle" aria-label="Checking availability" />
            ) : usernameState === "available" ? (
              <Check className="size-4 text-online" aria-label="Available" />
            ) : usernameState === "taken" ? (
              <X className="size-4 text-danger" aria-label="Taken" />
            ) : null
          }
          hint="This is how people can find and mention you."
        />
        <Input label="Email" type="email" leading={<Mail className="size-4" />} autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <div className="space-y-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
            error={errors.password}
            hint={!values.password ? "At least 8 characters." : undefined}
          />
          <StrengthMeter password={values.password} />
        </div>
        <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition", errors.confirmAdult ? "border-danger" : "border-border hover:border-border-strong")}>
          <input type="checkbox" checked={values.confirmAdult} onChange={(e) => set("confirmAdult", e.target.checked)} className="mt-0.5 size-4.5 accent-[var(--primary)]" />
          <span className="text-ink-muted">
            I&apos;m <strong className="text-ink">18 or older</strong> and I&apos;ll treat people with respect.
          </span>
        </label>
        {errors.confirmAdult && <p className="-mt-3 text-[0.8125rem] font-medium text-danger">{errors.confirmAdult}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={usernameState === "taken"}>
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-subtle">Your exact location is never shown to anyone. You choose when to share it.</p>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <MailCheck className="size-8" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
          If an account exists for <strong className="text-ink">{email}</strong>, we&apos;ve sent a link to reset your password. It works for one hour.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-primary-ink hover:underline">
          Back to sign in
        </Link>
      </motion.div>
    );
  }

  return (
    <>
      <FormHeader title="Forgot your password?" subtitle="No worries. Enter your email and we'll send you a reset link." />
      <form
        className="space-y-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = forgotPasswordSchema.safeParse({ email });
          if (!parsed.success) return setError(parsed.error.issues[0]?.message);
          setBusy(true);
          setError(undefined);
          try {
            await api.post("/api/auth/forgot-password", parsed.data);
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input label="Email" type="email" leading={<Mail className="size-4" />} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Send reset link
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="font-semibold text-primary-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <>
        <FormHeader title="Link not valid" subtitle="This reset link is missing or incomplete." />
        <Link href="/forgot-password" className="font-semibold text-primary-ink hover:underline">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <FormHeader title="Choose a new password" subtitle="Make it something you haven't used before." />
      {formError && (
        <Banner tone="error">
          {formError}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Banner>
      )}
      <form
        className="space-y-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setFormError(null);
          const parsed = resetPasswordSchema.safeParse({ token, password });
          if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
          if (password !== confirm) return setErrors({ confirm: "Passwords don't match." });
          setErrors({});
          setBusy(true);
          try {
            await api.post("/api/auth/reset-password", parsed.data);
            router.replace("/login?reset=1");
          } catch (err) {
            setFormError(err instanceof Error ? err.message : "Couldn't reset your password.");
            setBusy(false);
          }
        }}
      >
        <div className="space-y-2">
          <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoFocus />
          <StrengthMeter password={password} />
        </div>
        <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          <KeyRound className="size-4.5" aria-hidden /> Update password
        </Button>
      </form>
    </>
  );
}
