"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { getProject, archiveProject, ApiError } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Modal } from "@/components/shared/modal";
import { ProjectForm } from "@/components/projects/project-form";
import { MemoryList } from "@/components/memories/memory-list";

interface ProjectDetailViewProps {
  id: string;
}

export function ProjectDetailView({ id }: ProjectDetailViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    message: string;
    code?: string;
    isNotFound?: boolean;
  } | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchProjectDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({
          message: err.message,
          code: err.code,
          isNotFound: err.status === 404 || err.code === "PROJECT_NOT_FOUND",
        });
      } else {
        setError({ message: "Failed to load project." });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    getProject(id)
      .then((data) => {
        if (isMounted) {
          setProject(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError({
              message: err.message,
              code: err.code,
              isNotFound: err.status === 404 || err.code === "PROJECT_NOT_FOUND",
            });
          } else {
            setError({ message: "Failed to load project." });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleArchiveProject() {
    if (!project || archiving) return;
    if (
      !window.confirm(
        `Are you sure you want to archive project "${project.name}"?`
      )
    ) {
      return;
    }

    setArchiving(true);
    try {
      const updated = await archiveProject(project.id);
      setProject(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        alert("Error archiving project: " + err.message);
      } else {
        alert("Failed to archive project");
      }
    } finally {
      setArchiving(false);
    }
  }

  function handleProjectUpdated(updated: Project) {
    setIsEditOpen(false);
    setProject(updated);
  }

  if (loading) {
    return <LoadingState message="Loading project details..." />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-12 text-center">
        <ErrorState
          title={
            error.isNotFound ? "Project Not Found" : "Error Loading Project"
          }
          message={
            error.isNotFound
              ? "No project was found with ID '" +
                id +
                "'. It may have been removed or the ID is invalid."
              : error.message
          }
          code={error.code}
          onRetry={error.isNotFound ? undefined : fetchProjectDetails}
        />
        <div>
          <Link
            href="/projects"
            className="inline-flex rounded border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            &larr; Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href="/projects"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Projects
        </Link>
        <span>/</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {project.name}
        </span>
      </nav>

      {/* Project Details Banner */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {project.name}
              </h1>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                  (project.status === "ARCHIVED"
                    ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400")
                }
              >
                {project.status}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              /{project.slug} &bull; ID: {project.id}
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {project.description || "No description provided."}
            </p>
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
              Created:{" "}
              {new Date(project.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Project Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Edit Project
            </button>
            {project.status !== "ARCHIVED" && (
              <button
                onClick={handleArchiveProject}
                disabled={archiving}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {archiving ? "Archiving..." : "Archive Project"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Memories Section */}
      <section aria-labelledby="memories-section-title">
        <MemoryList projectId={project.id} />
      </section>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Project"
      >
        <ProjectForm
          project={project}
          onSuccess={handleProjectUpdated}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>
    </div>
  );
}
