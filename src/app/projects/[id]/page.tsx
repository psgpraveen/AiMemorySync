import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { ProjectDetailView } from "@/components/projects/project-detail-view";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <ProjectDetailView id={id} />
      </main>
      <Footer />
    </div>
  );
}
