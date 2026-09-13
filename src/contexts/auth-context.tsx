"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  startTransition,
  type ReactNode,
} from "react";
import {
  getCurrentSession,
  loginHuman,
  devBootstrapLogin,
  registerHuman,
  logoutHuman,
  switchTenant,
  verifyApiKey,
  getApiKey,
  setApiKey as setStoredApiKey,
  type SessionResponse,
  type LoginPayload,
  type LoginResponse,
  type RegisterPayload,
  type RegisterResponse,
  ApiError,
} from "@/lib/api-client";

export type KeyValidationStatus = "none" | "valid" | "invalid";

export interface AuthContextValue {
  // State
  session: SessionResponse | null;
  apiKey: string | null;
  keyStatus: KeyValidationStatus;
  loading: boolean;
  error: string | null;
  isSwitchingTenant: boolean;
  isAuthenticated: boolean;

  // Actions (API calls & mutations)
  refreshSession: () => Promise<SessionResponse | null>;
  login: (credentials: LoginPayload) => Promise<LoginResponse>;
  devBootstrap: () => Promise<LoginResponse>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  setMachineApiKey: (key: string | null) => Promise<boolean>;
  switchWorkspace: (tenantId: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? getApiKey() : null
  );
  const [keyStatus, setKeyStatus] = useState<KeyValidationStatus>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);

  const checkSession = useCallback(async (): Promise<SessionResponse | null> => {
    try {
      const currentSession = await getCurrentSession();
      startTransition(() => {
        setSession(currentSession);
      });
      return currentSession;
    } catch {
      startTransition(() => {
        setSession(null);
      });
      return null;
    }
  }, []);

  const checkApiKey = useCallback(async (keyToVerify?: string | null): Promise<boolean> => {
    const key = keyToVerify !== undefined ? keyToVerify : getApiKey();
    if (!key || key.trim().length === 0) {
      startTransition(() => {
        setApiKey(null);
        setKeyStatus("none");
      });
      return false;
    }

    try {
      const res = await verifyApiKey(key);
      startTransition(() => {
        setApiKey(key);
        setKeyStatus(res.valid ? "valid" : "invalid");
      });
      return res.valid;
    } catch {
      startTransition(() => {
        setApiKey(key);
        setKeyStatus("invalid");
      });
      return false;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<SessionResponse | null> => {
    setError(null);
    const [res] = await Promise.all([checkSession(), checkApiKey()]);
    return res;
  }, [checkSession, checkApiKey]);

  // Initial authentication hydration
  useEffect(() => {
    let isMounted = true;
    Promise.all([checkSession(), checkApiKey()])
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const handleAuthEvent = () => {
      void refreshSession();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("aimem:auth-change", handleAuthEvent);
    }

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("aimem:auth-change", handleAuthEvent);
      }
    };
  }, [checkSession, checkApiKey, refreshSession]);

  const login = useCallback(
    async (credentials: LoginPayload): Promise<LoginResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await loginHuman(credentials);
        startTransition(() => {
          setSession({
            user: res.user,
            activeTenant: res.activeTenant,
            memberships: res.memberships,
          });
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aimem:auth-change"));
        }
        return res;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Sign in failed. Please check your credentials.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const devBootstrap = useCallback(async (): Promise<LoginResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await devBootstrapLogin();
      startTransition(() => {
        setSession({
          user: res.user,
          activeTenant: res.activeTenant,
          memberships: res.memberships,
        });
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aimem:auth-change"));
      }
      return res;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Developer bootstrap failed.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await registerHuman(payload);
        startTransition(() => {
          setSession({
            user: res.user,
            activeTenant: res.activeTenant,
            memberships: [
              {
                tenantId: res.activeTenant.id,
                name: res.activeTenant.name,
                slug: res.activeTenant.slug,
                role: res.activeTenant.role,
              },
            ],
          });
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aimem:auth-change"));
        }
        return res;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to create workspace.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutHuman();
    } catch {
      // Continue client cleanup even if network fails
    }
    setStoredApiKey(null);
    startTransition(() => {
      setSession(null);
      setApiKey(null);
      setKeyStatus("none");
      setError(null);
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aimem:auth-change"));
    }
  }, []);

  const setMachineApiKey = useCallback(
    async (key: string | null): Promise<boolean> => {
      setStoredApiKey(key);
      const isValid = await checkApiKey(key);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aimem:auth-change"));
      }
      return isValid;
    },
    [checkApiKey]
  );

  const switchWorkspace = useCallback(
    async (tenantId: string): Promise<void> => {
      if (!tenantId || tenantId === session?.activeTenant.id) return;
      setIsSwitchingTenant(true);
      setError(null);
      try {
        const res = await switchTenant(tenantId);
        startTransition(() => {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  activeTenant: res.activeTenant,
                }
              : null
          );
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aimem:auth-change"));
        }
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to switch workspace.";
        setError(message);
        throw err;
      } finally {
        setIsSwitchingTenant(false);
      }
    },
    [session?.activeTenant.id]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isAuthenticated = Boolean(session || keyStatus === "valid");

  return (
    <AuthContext.Provider
      value={{
        session,
        apiKey,
        keyStatus,
        loading,
        error,
        isSwitchingTenant,
        isAuthenticated,
        refreshSession,
        login,
        devBootstrap,
        register,
        logout,
        setMachineApiKey,
        switchWorkspace,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
