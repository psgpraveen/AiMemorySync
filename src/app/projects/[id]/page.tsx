import { Navbar } from "@/components/shared/navbar";
import { ProjectDetailView } from "@/components/projects/project-detail-view";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <ProjectDetailView id={id} />
      </main>
    </div>
  );
}
