"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  startTransition,
  type ReactNode,
} from "react";
import {
  listApiKeys,
  createApiKey as apiCreateApiKey,
  revokeApiKey as apiRevokeApiKey,
  testIntegration as apiTestIntegration,
  type ApiKeyDto,
  type CreateApiKeyPayload,
  type CreateApiKeyResponse,
  type TestIntegrationPayload,
  type TestIntegrationResponse,
  ApiError,
} from "@/lib/api-client";

export interface ApiKeysContextValue {
  // State
  apiKeys: ApiKeyDto[];
  loading: boolean;
  error: string | null;

  // Actions (API calls & mutations)
  fetchApiKeys: () => Promise<ApiKeyDto[]>;
  createApiKey: (payload: CreateApiKeyPayload) => Promise<CreateApiKeyResponse>;
  revokeApiKey: (id: string) => Promise<void>;
  testIntegration: (
    payload: TestIntegrationPayload | string,
    apiKey?: string
  ) => Promise<TestIntegrationResponse>;
  clearError: () => void;
}

const ApiKeysContext = createContext<ApiKeysContextValue | undefined>(undefined);

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async (): Promise<ApiKeyDto[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApiKeys();
      startTransition(() => {
        setApiKeys(data);
      });
      return data;
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load API keys.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createApiKey = useCallback(
    async (payload: CreateApiKeyPayload): Promise<CreateApiKeyResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiCreateApiKey(payload);
        startTransition(() => {
          setApiKeys((prev) => [res.apiKey, ...prev]);
        });
        return res;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to generate API key.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const revokeApiKey = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiRevokeApiKey(id);
        startTransition(() => {
          setApiKeys((prev) => prev.filter((k) => k.id !== id));
        });
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to revoke API key.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const testIntegration = useCallback(
    async (
      payload: TestIntegrationPayload | string,
      apiKey?: string
    ): Promise<TestIntegrationResponse> => {
      setError(null);
      try {
        const reqPayload: TestIntegrationPayload =
          typeof payload === "string"
            ? { integration: payload, apiKey }
            : payload;
        return await apiTestIntegration(reqPayload);
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to test integration.";
        setError(message);
        throw err;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ApiKeysContext.Provider
      value={{
        apiKeys,
        loading,
        error,
        fetchApiKeys,
        createApiKey,
        revokeApiKey,
        testIntegration,
        clearError,
      }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys(): ApiKeysContextValue {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error("useApiKeys must be used within an ApiKeysProvider");
  }
  return context;
}
