import { z } from "zod";

/**
 * Supported package ecosystems for manifest-based identity resolution.
 */
export const packageEcosystemSchema = z
  .string()
  .min(1, "Ecosystem cannot be empty")
  .max(50, "Ecosystem name too long")
  .trim();

/**
 * Package manifest identity signal.
 */
export const packageManifestSignalSchema = z.object({
  ecosystem: packageEcosystemSchema,
  name: z
    .string()
    .min(1, "Package name cannot be empty")
    .max(200, "Package name cannot exceed 200 characters")
    .trim(),
});

/**
 * Identity discovery signals payload provided by client IDEs or platform connectors.
 */
export const discoverySignalsSchema = z.object({
  gitRemoteUrl: z
    .string()
    .max(500, "Git remote URL cannot exceed 500 characters")
    .trim()
    .optional(),
  monorepoSubPath: z
    .string()
    .max(255, "Monorepo subpath cannot exceed 255 characters")
    .trim()
    .optional(),
  packageManifest: packageManifestSignalSchema.optional(),
  workspaceName: z
    .string()
    .max(100, "Workspace name cannot exceed 100 characters")
    .trim()
    .optional(),
  localPath: z
    .string()
    .max(1000, "Local path cannot exceed 1000 characters")
    .trim()
    .optional(),
});

/**
 * Platform and client environment source metadata.
 */
export const discoverySourceSchema = z.object({
  platform: z
    .string()
    .min(1, "Platform name is required")
    .max(50, "Platform name cannot exceed 50 characters")
    .trim()
    .toUpperCase(),
  externalId: z
    .string()
    .max(255, "External ID cannot exceed 255 characters")
    .trim()
    .optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          return JSON.stringify(val).length <= 65536; // Max 64KB
        } catch {
          return false;
        }
      },
      { message: "Metadata payload size must not exceed 64KB" }
    ),
});

/**
 * Main validation schema for POST /api/projects/resolve.
 */
export const resolveProjectSchema = z
  .object({
    signals: discoverySignalsSchema,
    source: discoverySourceSchema,
  })
  .superRefine((data, ctx) => {
    const hasGit = Boolean(data.signals.gitRemoteUrl?.trim());
    const hasPkg = Boolean(data.signals.packageManifest?.name?.trim());
    const hasWorkspace = Boolean(data.signals.workspaceName?.trim());
    const hasLocalPath = Boolean(data.signals.localPath?.trim());
    const hasExternalId = Boolean(data.source.externalId?.trim());

    if (!hasGit && !hasPkg && !hasWorkspace && !hasLocalPath && !hasExternalId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signals"],
        message:
          "At least one valid identity signal (gitRemoteUrl, packageManifest, workspaceName, localPath, or externalId) must be provided.",
      });
    }
  });

export type ResolveProjectInput = z.infer<typeof resolveProjectSchema>;
export type DiscoverySignalsInput = z.infer<typeof discoverySignalsSchema>;
export type DiscoverySourceInput = z.infer<typeof discoverySourceSchema>;
