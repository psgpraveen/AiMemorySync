"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  startTransition,
  type ReactNode,
} from "react";
import type { Memory } from "@prisma/client";
import {
  getProjectMemories,
  getMemories,
  createMemory as apiCreateMemory,
  createTenantMemory as apiCreateTenantMemory,
  updateMemory as apiUpdateMemory,
  deprecateMemory as apiDeprecateMemory,
  archiveMemory as apiArchiveMemory,
  deleteMemory as apiDeleteMemory,
  type CreateMemoryPayload,
  type UpdateMemoryPayload,
  ApiError,
} from "@/lib/api-client";

export interface MemoriesContextValue {
  // State
  memories: Memory[];
  loading: boolean;
  error: string | null;

  // Actions (API calls & mutations)
  fetchMemories: (projectId?: string | null) => Promise<Memory[]>;
  createMemory: (
    projectId: string | undefined | null,
    payload: CreateMemoryPayload
  ) => Promise<Memory>;
  updateMemory: (id: string, payload: UpdateMemoryPayload) => Promise<Memory>;
  deprecateMemory: (id: string) => Promise<Memory>;
  archiveMemory: (id: string) => Promise<Memory>;
  deleteMemory: (id: string) => Promise<void>;
  clearError: () => void;
}

const MemoriesContext = createContext<MemoriesContextValue | undefined>(undefined);

export function MemoriesProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(
    async (projectId?: string | null): Promise<Memory[]> => {
      setLoading(true);
      setError(null);
      try {
        let data: Memory[];
        if (projectId) {
          data = await getProjectMemories(projectId);
        } else {
          data = await getMemories();
        }
        startTransition(() => {
          setMemories(data);
        });
        return data;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load memories.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createMemory = useCallback(
    async (
      projectId: string | undefined | null,
      payload: CreateMemoryPayload
    ): Promise<Memory> => {
      setLoading(true);
      setError(null);
      try {
        const created = projectId
          ? await apiCreateMemory(projectId, payload)
          : await apiCreateTenantMemory(payload);
        startTransition(() => {
          setMemories((prev) => [created, ...prev]);
        });
        return created;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to create memory.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateMemory = useCallback(
    async (id: string, payload: UpdateMemoryPayload): Promise<Memory> => {
      setLoading(true);
      setError(null);
      try {
        const updated = await apiUpdateMemory(id, payload);
        startTransition(() => {
          setMemories((prev) =>
            prev.map((m) => (m.id === id ? updated : m))
          );
        });
        return updated;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to update memory.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deprecateMemory = useCallback(
    async (id: string): Promise<Memory> => {
      setLoading(true);
      setError(null);
      try {
        const deprecated = await apiDeprecateMemory(id);
        startTransition(() => {
          setMemories((prev) =>
            prev.map((m) => (m.id === id ? deprecated : m))
          );
        });
        return deprecated;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to deprecate memory.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const archiveMemory = useCallback(
    async (id: string): Promise<Memory> => {
      setLoading(true);
      setError(null);
      try {
        const archived = await apiArchiveMemory(id);
        startTransition(() => {
          setMemories((prev) =>
            prev.map((m) => (m.id === id ? archived : m))
          );
        });
        return archived;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to archive memory.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteMemory = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiDeleteMemory(id);
        startTransition(() => {
          setMemories((prev) => prev.filter((m) => m.id !== id));
        });
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to delete memory.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <MemoriesContext.Provider
      value={{
        memories,
        loading,
        error,
        fetchMemories,
        createMemory,
        updateMemory,
        deprecateMemory,
        archiveMemory,
        deleteMemory,
        clearError,
      }}
    >
      {children}
    </MemoriesContext.Provider>
  );
}

export function useMemories(): MemoriesContextValue {
  const context = useContext(MemoriesContext);
  if (!context) {
    throw new Error("useMemories must be used within a MemoriesProvider");
  }
  return context;
}
