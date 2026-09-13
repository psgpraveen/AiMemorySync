"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { ProjectsProvider } from "./projects-context";
import { MemoriesProvider } from "./memories-context";
import { ApiKeysProvider } from "./api-keys-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectsProvider>
        <MemoriesProvider>
          <ApiKeysProvider>{children}</ApiKeysProvider>
        </MemoriesProvider>
      </ProjectsProvider>
    </AuthProvider>
  );
}
