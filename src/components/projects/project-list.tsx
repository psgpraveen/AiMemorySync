"use client";

import { useEffect, useState, useCallback } from "react";
import type { Project } from "@prisma/client";
import { getProjects, ApiError } from "@/lib/api-client";
import { ProjectCard } from "./project-card";
import { ProjectForm } from "./project-form";
import { Modal } from "@/components/shared/modal";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonCard } from "@/components/shared/loading-state";

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchActiveProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects("ACTIVE");
      setProjects(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, code: err.code });
      } else {
        setError({ message: "Failed to load projects. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getProjects("ACTIVE")
      .then((data) => {
        if (isMounted) {
          setProjects(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError({ message: err.message, code: err.code });
          } else {
            setError({ message: "Failed to load projects. Please try again." });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleProjectCreated(newProject: Project) {
    setIsCreateOpen(false);
    setProjects((prev) => [newProject, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Projects
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage your synchronized AI memory projects.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Project
        </button>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load projects"
          message={error.message}
          code={error.code}
          onRetry={fetchActiveProjects}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No active projects"
          description="Get started by creating your first AI memory project."
          actionLabel="Create Project"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
      >
        <ProjectForm
          onSuccess={handleProjectCreated}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
