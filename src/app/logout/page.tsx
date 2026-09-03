"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setApiKey } from "@/lib/api-client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    setApiKey(null);
    router.replace("/login?loggedOut=true");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white mesh-gradient-bg">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-xs font-medium text-slate-600">Signing out of AiMemorySync...</p>
      </div>
    </div>
  );
}
