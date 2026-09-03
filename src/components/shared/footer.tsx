import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md transition-colors mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Author Attribution */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-linear-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                M
              </div>
              <span className="font-semibold text-sm tracking-tight text-slate-900">
                AiMemory<span className="text-indigo-600">Sync</span>
              </span>
            </div>

            <span className="hidden sm:inline text-slate-300">|</span>

            <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap justify-center">
              <span>Architected & Built by</span>
              <a
                href="https://github.com/psgpraveen"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-900 hover:text-indigo-600 underline decoration-indigo-400/40 hover:decoration-indigo-500 transition-colors"
              >
                PSG Praveen
              </a>
              <span className="text-slate-400 font-mono text-[11px]">(@psgpraveen)</span>
            </div>
          </div>

          {/* Quick Links */}
          <nav className="flex items-center gap-5 text-xs text-slate-600 flex-wrap justify-center font-medium">
            <Link
              href="/projects"
              className="hover:text-indigo-600 transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/integrations"
              className="hover:text-indigo-600 transition-colors"
            >
              Integrations
            </Link>
            <Link
              href="/settings/api-keys"
              className="hover:text-indigo-600 transition-colors"
            >
              API Keys
            </Link>
            <Link
              href="/login"
              className="hover:text-indigo-600 transition-colors"
            >
              Connect
            </Link>
            <a
              href="https://github.com/psgpraveen"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-200 transition"
            >
              <span>GitHub</span>
              <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </a>
          </nav>
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 font-medium">Universal AI Memory Engine · Standard MCP Transport Ready</span>
          </div>

          <div className="text-slate-500">
            © {currentYear} AiMemorySync · All rights reserved · Created by <strong className="font-semibold text-slate-700">PSG Praveen</strong>
          </div>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
