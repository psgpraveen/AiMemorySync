import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { getIntegrationById } from "@/lib/integrations/registry";
import { CodeBlock } from "@/components/integrations/code-block";

interface PageProps {
  params: Promise<{
    integrationId: string;
  }>;
}

export default async function IntegrationDetailPage({ params }: PageProps) {
  const { integrationId } = await params;
  const integration = getIntegrationById(integrationId);

  if (!integration) {
    notFound();
  }

  const isAvailable = integration.status === "available";

  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
      <Navbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/integrations" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Integrations
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">
            {integration.name}
          </span>
        </div>

        {/* Hero Header */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 font-mono text-base font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {integration.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {integration.name} Integration
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {integration.tagline}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAvailable && integration.setupRoute && (
              <Link
                href={integration.setupRoute}
                className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs transition"
              >
                Start Guided Setup &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Overview & Architecture */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                About this Integration
              </h2>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {integration.description}
              </p>

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Key Features & Capabilities
              </h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-zinc-700 dark:text-zinc-300">
                {integration.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Steps Overview */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Installation & Setup Workflow
              </h2>
              <div className="space-y-6">
                {integration.steps.map((step) => (
                  <div key={step.id} className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 font-mono text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {step.stepNumber}
                      </span>
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {step.description}
                    </p>
                    {step.codeSnippet && (
                      <div className="mt-3">
                        <CodeBlock
                          code={step.codeSnippet.code}
                          language={step.codeSnippet.language}
                          filename={step.codeSnippet.filename}
                        />
                      </div>
                    )}
                    {step.actionButton && step.actionButton.href && (
                      <div className="mt-3">
                        <a
                          href={step.actionButton.href}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span>{step.actionButton.label}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                Integration Specifications
              </h3>
              <dl className="mt-3 divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                <div className="flex justify-between py-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{integration.category}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Transport</dt>
                  <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                    {integration.installationType.toUpperCase()}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
                  <dd className="font-medium text-emerald-600 dark:text-emerald-400 capitalize">
                    {integration.status.replace("_", " ")}
                  </dd>
                </div>
              </dl>

              {isAvailable && integration.setupRoute && (
                <div className="mt-5">
                  <Link
                    href={integration.setupRoute}
                    className="block w-full text-center rounded bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
                  >
                    Open Installation Wizard &rarr;
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Need Help?
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Check our documentation or generate a support diagnostic report.
              </p>
              <Link
                href="/settings/api-keys"
                className="mt-3 block text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                &rarr; Manage API Keys
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
