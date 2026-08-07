"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession, login as apiLogin, logout as apiLogout } from "@/services/auth.service";
import type { AuthOrganization, AuthUser } from "@/lib/auth";
import { ApiError } from "@/services/api-client";

// ── Shared auth-change notification ─────────────────────────────────────────
// Several components mount their own `useAuth()` instance (AuthGate, the app
// header, the login page, …) and each instance holds local state that is only
// resolved from `/api/auth/session` once, on mount. That means a login that
// updates state in one instance never reaches the others, so after a
// successful login `AuthGate` still thinks the user is anonymous and bounces
// the client back to /login until a full page reload re-runs the mount fetch.
//
// A successful login/logout fires a module-level event and every mounted
// instance re-resolves the session, keeping the whole app shell in sync
// without a page reload.
type AuthChangeListener = () => void | Promise<void>;
const authChangeListeners = new Set<AuthChangeListener>();

async function notifyAuthChanged(): Promise<void> {
  const listeners = [...authChangeListeners];
  await Promise.allSettled(listeners.map((listener) => Promise.resolve(listener())));
}

function subscribeAuthChanged(listener: AuthChangeListener): () => void {
  authChangeListeners.add(listener);
  return () => {
    authChangeListeners.delete(listener);
  };
}

export { subscribeAuthChanged };

interface UseAuthResult {
  readonly user: AuthUser | null;
  readonly organization: AuthOrganization | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly login: (email: string, password: string) => Promise<boolean>;
  readonly logout: () => Promise<void>;
  readonly refetch: () => void;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const session = await getSession();
      setUser(session.user);
      setOrganization(session.organization);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Stay in sync with auth changes made by other `useAuth()` instances (e.g.
  // a login performed on this page while AuthGate is mounted in the root
  // layout), so protected routes gate on the session immediately. The
  // notification is awaited by the caller, so by the time `login()`/`logout()`
  // resolves every mounted instance has already re-resolved its session.
  useEffect(() => {
    return subscribeAuthChanged(() => fetchSession());
  }, [fetchSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await apiLogin({ email, password });
        setUser(session.user);
        setOrganization(session.organization);
        await notifyAuthChanged();
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setOrganization(null);
      await notifyAuthChanged();
    }
  }, []);

  return {
    user,
    organization,
    isLoading,
    error,
    login,
    logout,
    refetch: fetchSession,
  };
}
