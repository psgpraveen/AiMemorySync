"use client";

import { useEffect, useState } from "react";
import { useProjects } from "@/contexts";
import { ProjectCard } from "./project-card";
import { ProjectForm } from "./project-form";
import { Modal } from "@/components/shared/modal";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonCard } from "@/components/shared/loading-state";

export function ProjectList() {
  const { projects, loading, error, fetchProjects } = useProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    void fetchProjects("ACTIVE");
  }, [fetchProjects]);

  function handleProjectCreated() {
    setIsCreateOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your synchronized AI memory projects across all development environments.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02]"
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
          message={error}
          onRetry={() => fetchProjects("ACTIVE")}
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
