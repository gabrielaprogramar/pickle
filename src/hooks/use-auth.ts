"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession, login as apiLogin, logout as apiLogout } from "@/services/auth.service";
import type { AuthOrganization, AuthUser } from "@/lib/auth";
import { ApiError } from "@/services/api-client";

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

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await apiLogin({ email, password });
        setUser(session.user);
        setOrganization(session.organization);
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
