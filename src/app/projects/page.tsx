import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { ProjectList } from "@/components/projects/project-list";

export const metadata = {
  title: "Projects | AiMemorySync",
  description: "Manage your AI memory projects",
};

export default function ProjectsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <ProjectList />
      </main>
      <Footer />
    </div>
  );
}
