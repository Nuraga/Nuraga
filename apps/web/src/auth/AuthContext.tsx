import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api/auth";
import { clearTokens, getRefreshToken, hasSession, setTokens, onSessionExpired } from "../api/client";
import type { CurrentUser } from "../api/types";

type LoginOutcome =
  | { status: "mfa_required"; mfaToken: string }
  | { status: "ok"; totpSetupRequired: boolean };

interface AuthContextValue {
  user: CurrentUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (identifier: string, password: string) => Promise<LoginOutcome>;
  verifyTwoFactor: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const loadCurrentUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch {
      clearTokens();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    if (hasSession()) {
      void loadCurrentUser();
    } else {
      setStatus("unauthenticated");
    }
  }, [loadCurrentUser]);

  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus("unauthenticated");
      }),
    [],
  );

  const login = useCallback(
    async (identifier: string, password: string): Promise<LoginOutcome> => {
      const result = await authApi.login(identifier, password);
      if (result.status === "mfa_required") {
        return { status: "mfa_required", mfaToken: result.mfaToken };
      }
      setTokens(result);
      await loadCurrentUser();
      return { status: "ok", totpSetupRequired: result.totpSetupRequired };
    },
    [loadCurrentUser],
  );

  const verifyTwoFactor = useCallback(
    async (mfaToken: string, code: string) => {
      const pair = await authApi.verify2fa(mfaToken, code);
      setTokens(pair);
      await loadCurrentUser();
    },
    [loadCurrentUser],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // best-effort — the token is already cleared client-side
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, verifyTwoFactor, logout }),
    [user, status, login, verifyTwoFactor, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
