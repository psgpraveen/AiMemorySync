import Link from "next/link";
import type { Project } from "@prisma/client";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formattedDate = new Date(project.createdAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  const isArchived = project.status === "ARCHIVED";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
            {project.name}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
            /{project.slug}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isArchived
              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          }`}
        >
          {project.status}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
        {project.description || "No description provided."}
      </p>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>Created {formattedDate}</span>
        <span className="font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
          View memories &rarr;
        </span>
      </div>
    </Link>
  );
}
