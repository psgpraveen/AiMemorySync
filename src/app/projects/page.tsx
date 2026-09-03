import { Navbar } from "@/components/shared/navbar";
import { ProjectList } from "@/components/projects/project-list";

export const metadata = {
  title: "Projects | AiMemorySync",
  description: "Manage your AI memory projects",
};

export default function ProjectsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <ProjectList />
      </main>
    </div>
  );
}
