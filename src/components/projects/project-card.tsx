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
      className="group block rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-indigo-400/80 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
            {project.name}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            /{project.slug}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            isArchived
              ? "bg-slate-100 text-slate-600"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
          }`}
        >
          {project.status}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
        {project.description || "No description provided."}
      </p>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>Created {formattedDate}</span>
        <span className="font-semibold text-indigo-600 group-hover:text-indigo-500 flex items-center gap-1 transition-colors">
          <span>View memories</span>
          <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
        </span>
      </div>
    </Link>
  );
}
