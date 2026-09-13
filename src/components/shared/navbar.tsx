"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts";

export function Navbar() {
  const router = useRouter();
  const {
    session,
    keyStatus,
    isSwitchingTenant,
    logout,
    switchWorkspace,
  } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login?loggedOut=true");
    router.refresh();
  }

  async function handleSwitchWorkspace(tenantId: string) {
    if (!tenantId || tenantId === session?.activeTenant.id) return;
    try {
      await switchWorkspace(tenantId);
      router.refresh();
    } catch {
      // Handled in context
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-sans text-sm font-bold tracking-tight text-slate-900 hover:opacity-90 group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-xs font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
                M
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-base tracking-tight text-slate-900">
                  AiMemory<span className="text-indigo-600">Sync</span>
                </span>
                <span className="hidden md:inline-flex items-center rounded-full bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  by psgpraveen
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium">
              <Link
                href="/projects"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Projects
              </Link>
              <Link
                href="/integrations"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Integrations
              </Link>
              <Link
                href="/settings/api-keys"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                API Keys
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Workspace / Tenant Selector */}
            {session && (
              <div className="flex items-center gap-2">
                {session.memberships.length > 1 ? (
                  <select
                    value={session.activeTenant.id}
                    onChange={(e) => handleSwitchWorkspace(e.target.value)}
                    disabled={isSwitchingTenant}
                    className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    title="Switch Workspace"
                  >
                    {session.memberships.map((m) => (
                      <option key={m.tenantId} value={m.tenantId}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-indigo-50/70 px-2.5 py-1 text-xs font-medium text-indigo-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span>{session.activeTenant.name}</span>
                    <span className="text-[10px] text-indigo-500 uppercase font-bold">
                      {session.activeTenant.role}
                    </span>
                  </span>
                )}

                <span className="hidden md:inline-block text-xs text-slate-600 font-medium">
                  {session.user.name}
                </span>
              </div>
            )}

            {/* Log Out or Sign In */}
            {session || keyStatus === "valid" ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition shadow-2xs cursor-pointer"
                title="Log out"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log Out</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 transition shadow-xs"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
