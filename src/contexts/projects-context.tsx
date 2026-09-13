"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  startTransition,
  type ReactNode,
} from "react";
import type { Project, ProjectStatus } from "@prisma/client";
import {
  getProjects,
  getProject,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  archiveProject as apiArchiveProject,
  deleteProject as apiDeleteProject,
  type CreateProjectPayload,
  type UpdateProjectPayload,
  ApiError,
} from "@/lib/api-client";

export interface ProjectsContextValue {
  // State
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  error: string | null;

  // Actions (API calls & mutations)
  fetchProjects: (status?: ProjectStatus) => Promise<Project[]>;
  fetchProject: (id: string) => Promise<Project>;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  updateProject: (id: string, payload: UpdateProjectPayload) => Promise<Project>;
  archiveProject: (id: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  clearError: () => void;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(
    async (status: ProjectStatus = "ACTIVE"): Promise<Project[]> => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjects(status);
        startTransition(() => {
          setProjects(data);
        });
        return data;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load projects.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchProject = useCallback(async (id: string): Promise<Project> => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(id);
      startTransition(() => {
        setActiveProject(data);
        setProjects((prev) => {
          const index = prev.findIndex((p) => p.id === id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = data;
            return next;
          }
          return [data, ...prev];
        });
      });
      return data;
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load project details.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (payload: CreateProjectPayload): Promise<Project> => {
      setLoading(true);
      setError(null);
      try {
        const created = await apiCreateProject(payload);
        startTransition(() => {
          setProjects((prev) => [created, ...prev]);
        });
        return created;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to create project.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProject = useCallback(
    async (id: string, payload: UpdateProjectPayload): Promise<Project> => {
      setLoading(true);
      setError(null);
      try {
        const updated = await apiUpdateProject(id, payload);
        startTransition(() => {
          setActiveProject((prev) => (prev?.id === id ? updated : prev));
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? updated : p))
          );
        });
        return updated;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to update project.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const archiveProject = useCallback(
    async (id: string): Promise<Project> => {
      setLoading(true);
      setError(null);
      try {
        const archived = await apiArchiveProject(id);
        startTransition(() => {
          setActiveProject((prev) => (prev?.id === id ? archived : prev));
          setProjects((prev) =>
            prev.filter((p) => p.id !== id)
          );
        });
        return archived;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to archive project.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiDeleteProject(id);
        startTransition(() => {
          setActiveProject((prev) => (prev?.id === id ? null : prev));
          setProjects((prev) => prev.filter((p) => p.id !== id));
        });
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to delete project.";
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
    <ProjectsContext.Provider
      value={{
        projects,
        activeProject,
        loading,
        error,
        fetchProjects,
        fetchProject,
        createProject,
        updateProject,
        archiveProject,
        deleteProject,
        setActiveProject,
        clearError,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextValue {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectsProvider");
  }
  return context;
}
