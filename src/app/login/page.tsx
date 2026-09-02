"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_OWNER } from "@/constants/demo";

export default function LoginPage() {
  const router = useRouter();
  const { login, error, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await login(email, password);
      if (ok) router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDemoAccess() {
    setDemoBusy(true);
    try {
      const ok = await login(DEMO_OWNER.email, DEMO_OWNER.password);
      if (ok) router.replace("/");
    } finally {
      setDemoBusy(false);
    }
  }

  const busy = isLoading || submitting || demoBusy;

  // Demo access is gated behind NEXT_PUBLIC_ENABLE_DEMO so it can be shown in
  // development/demo builds but hidden in production (where its credentials
  // must never exist in the real database).
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";

  return (
    <AuthShell label="Secure Access" title="Sign in" subtitle="Access your Poseidon Ledger workspace">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        {error && !isLoading && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demoEnabled && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Demo
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={onDemoAccess}
          >
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            {demoBusy ? "Entering demo…" : "Enter demo workspace"}
          </Button>
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            One click — no credentials needed
          </p>
        </div>
      )}
    </AuthShell>
  );
}
