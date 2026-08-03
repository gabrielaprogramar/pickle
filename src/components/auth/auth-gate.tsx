"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const AUTH_PATHS: readonly string[] = ["/login", "/forgot-password", "/reset-password"];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (p) => pathname === p || (p === "/reset-password" && pathname.startsWith("/reset-password")),
  );
}

/**
 * AuthGate — route protection for the app shell.
 *
 * Renders nothing while the session resolves, then either renders children or
 * redirects to /login. Auth pages are excluded so unauthenticated users can
 * always reach them. When an authenticated user visits an auth page they are
 * sent back to the dashboard.
 */
export function AuthGate({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const isAuthPathValue = isAuthPath(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthPathValue && !user) {
      router.replace("/login");
      return;
    }
    if (isAuthPathValue && user) {
      router.replace("/");
    }
  }, [isLoading, isAuthPathValue, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Loading workspace
          </p>
        </div>
      </div>
    );
  }

  // Auth pages: render bare (no shell) regardless of session.
  if (isAuthPathValue) {
    return <>{children}</>;
  }

  // Protected pages: only render the shell when authenticated.
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
