"use client";

import { useState, type FormEvent } from "react";
import type { Project } from "@prisma/client";
import { useProjects } from "@/contexts";

interface ProjectFormProps {
  project?: Project; // If provided, edit mode; otherwise, create mode
  onSuccess: (project: Project) => void;
  onCancel: () => void;
}

export function ProjectForm({
  project,
  onSuccess,
  onCancel,
}: ProjectFormProps) {
  const isEdit = !!project;
  const { createProject, updateProject } = useProjects();

  const [name, setName] = useState(project?.name ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isEdit && project) {
        const updated = await updateProject(project.id, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
        });
        onSuccess(updated);
      } else {
        const created = await createProject({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
        });
        onSuccess(created);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <div>
        <label
          htmlFor="project-name"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          id="project-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. E-Commerce Platform"
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="project-slug"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Slug{" "}
          <span className="text-zinc-400">
            (optional, auto-generated from name if omitted)
          </span>
        </label>
        <input
          id="project-slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. e-commerce-platform"
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="project-description"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="project-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the project and its goals..."
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Saving..." : isEdit ? "Update Project" : "Create Project"}
        </button>
      </div>
    </form>
  );
}
