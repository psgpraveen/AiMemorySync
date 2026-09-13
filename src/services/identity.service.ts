import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeSlug } from "@/lib/hash";
import { DEFAULT_LEGACY_TENANT_ID } from "@/config/tenant";
import {
  normalizeGitRemote,
  normalizeMonorepoSubproject,
  normalizeManifestIdentity,
  normalizeWorkspaceDigest,
  normalizePlatformSession,
  generateIdentityHash,
  generateLocalPathDigest,
  extractRepoNameFromGitUrl,
} from "@/lib/identity-normalizer";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import {
  resolveProjectSchema,
  type ResolveProjectInput,
} from "@/validations/discovery.validation";
import type {
  ProjectIdentity,
  ProjectSource,
  ProjectIdentityType,
  ResolveProjectResult,
} from "@/types/domain";

interface CandidateIdentity {
  type: ProjectIdentityType;
  value: string;
  hash: string;
  confidence: number;
}

/**
 * Builds candidate identities sorted strictly by confidence hierarchy.
 */
export function extractCandidateIdentities(
  input: ResolveProjectInput
): CandidateIdentity[] {
  const candidates: CandidateIdentity[] = [];
  const { signals, source } = input;

  // Tier 1 / 1B: Git Remote / Monorepo Subproject
  if (signals.gitRemoteUrl && signals.gitRemoteUrl.trim()) {
    if (signals.monorepoSubPath && signals.monorepoSubPath.trim()) {
      const value = normalizeMonorepoSubproject(
        signals.gitRemoteUrl,
        signals.monorepoSubPath
      );
      if (value) {
        candidates.push({
          type: "MONOREPO_SUBPROJECT",
          value,
          hash: generateIdentityHash(value),
          confidence: 95,
        });
      }
    } else {
      const value = normalizeGitRemote(signals.gitRemoteUrl);
      if (value) {
        candidates.push({
          type: "GIT_REMOTE",
          value,
          hash: generateIdentityHash(value),
          confidence: 100,
        });
      }
    }
  }

  // Tier 2: Package Manifest
  if (signals.packageManifest && signals.packageManifest.name.trim()) {
    const value = normalizeManifestIdentity(
      signals.packageManifest.ecosystem,
      signals.packageManifest.name
    );
    if (value) {
      candidates.push({
        type: "PACKAGE_MANIFEST",
        value,
        hash: generateIdentityHash(value),
        confidence: 80,
      });
    }
  }

  // Tier 3: Workspace Digest
  if (signals.workspaceName?.trim() || signals.localPath?.trim()) {
    const folderName =
      signals.workspaceName?.trim() ||
      (signals.localPath ? signals.localPath.split(/[/\\]/).pop() || "workspace" : "workspace");
    const clientId = source.externalId || "client";
    const value = normalizeWorkspaceDigest(clientId, folderName, signals.localPath);
    if (value) {
      candidates.push({
        type: "WORKSPACE_DIGEST",
        value,
        hash: generateIdentityHash(value),
        confidence: 50,
      });
    }
  }

  // Tier 4: Platform Session
  if (source.platform && source.externalId?.trim()) {
    const value = normalizePlatformSession(source.platform, source.externalId);
    if (value) {
      candidates.push({
        type: "PLATFORM_SESSION",
        value,
        hash: generateIdentityHash(value),
        confidence: 30,
      });
    }
  }

  // Sort candidates by confidence descending
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Derives an intelligent human-readable project name from available discovery signals.
 */
export function deriveProjectName(input: ResolveProjectInput): string {
  const { signals, source } = input;

  // 1. Package name (strip scope if needed or use full package name)
  if (signals.packageManifest?.name?.trim()) {
    const rawName = signals.packageManifest.name.trim();
    const cleanName = rawName.startsWith("@") && rawName.includes("/")
      ? rawName.split("/")[1]
      : rawName;
    if (cleanName) return cleanName;
  }

  // 2. Git repo name
  if (signals.gitRemoteUrl?.trim()) {
    const repoName = extractRepoNameFromGitUrl(signals.gitRemoteUrl);
    if (repoName) return repoName;
  }

  // 3. Workspace name
  if (signals.workspaceName?.trim()) {
    return signals.workspaceName.trim();
  }

  // 4. Local path folder name
  if (signals.localPath?.trim()) {
    const segments = signals.localPath.trim().replace(/\\/g, "/").split("/").filter(Boolean);
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
  }

  // 5. Platform session title
  if (source.externalId?.trim()) {
    return `${source.platform} Project (${source.externalId.slice(0, 8)})`;
  }

  return "Discovered Project";
}

/**
 * Generates a non-colliding URL-safe slug for automatically discovered projects within a tenant.
 */
async function generateUniqueAutoSlug(
  baseName: string,
  tenantId: string = DEFAULT_LEGACY_TENANT_ID
): Promise<string> {
  const baseSlug = normalizeSlug(baseName) || "project";

  const existing = await prisma.project.findFirst({
    where: { slug: baseSlug, tenantId },
  });

  if (!existing) {
    return baseSlug;
  }

  // Find all conflicting slugs starting with baseSlug in this tenant
  const conflicts = await prisma.project.findMany({
    where: {
      tenantId,
      slug: {
        startsWith: baseSlug,
      },
    },
    select: { slug: true },
  });

  const existingSlugs = new Set(conflicts.map((c) => c.slug));
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}

/**
 * Resolves an incoming identity signal payload to an existing Project or provisions a new one.
 *
 * Implements:
 * 1. 4-tier confidence matching
 * 2. Automatic project creation with intelligent naming and collision-free slug derivation
 * 3. Secondary identity/alias attachment
 * 4. ProjectSource record tracking
 * 5. P2002 unique constraint race-condition recovery
 */
export async function resolveProjectIdentity(
  rawInput: ResolveProjectInput,
  tenantId: string = DEFAULT_LEGACY_TENANT_ID,
  allowedProjectId?: string
): Promise<ResolveProjectResult> {
  const parseResult = resolveProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project resolution input",
      parseResult.error.flatten()
    );
  }

  const input = parseResult.data;
  const candidates = extractCandidateIdentities(input);

  if (candidates.length === 0) {
    throw new ValidationError(
      "Could not generate any valid canonical identities from provided signals",
      { signals: ["No valid identity signals found"] }
    );
  }

  // --- 1. SEARCH EXISTING IDENTITIES (in confidence order) ---
  for (const candidate of candidates) {
    const existingIdentity = await prisma.projectIdentity.findUnique({
      where: {
        type_identityHash: {
          type: candidate.type,
          identityHash: candidate.hash,
        },
      },
      include: {
        project: true,
      },
    });

    if (existingIdentity && existingIdentity.project) {
      // Must belong to the caller's tenant! (Never leak or cross into another tenant)
      if (existingIdentity.project.tenantId !== tenantId) {
        continue;
      }

      // If key is project-scoped, enforce project match
      if (allowedProjectId && existingIdentity.project.id !== allowedProjectId) {
        throw new ForbiddenError(
          `API key is scoped exclusively to project '${allowedProjectId}' and cannot access '${existingIdentity.project.id}'`
        );
      }

      const project = existingIdentity.project;

      // Attach any other valid candidates not yet registered as secondary identities
      await attachSecondaryIdentities(project.id, candidates, candidate.hash);

      // Record / update ProjectSource
      await recordProjectSource(project.id, input.source, input.signals.localPath);

      return {
        project,
        matchedBy: candidate.type,
        canonicalIdentity: candidate.value,
        confidence: candidate.confidence,
        isNewlyCreated: false,
      };
    }
  }

  // --- 2. AUTO-CREATE NEW PROJECT (when no identity matched in this tenant) ---
  // Project-scoped machine keys cannot auto-create new projects
  if (allowedProjectId) {
    throw new ForbiddenError(
      "Project-scoped API key cannot resolve or provision new projects"
    );
  }

  const derivedName = deriveProjectName(input);
  const derivedSlug = await generateUniqueAutoSlug(derivedName, tenantId);
  const primaryCandidate = candidates[0]; // Highest confidence candidate becomes primary
  const localPathDigest = generateLocalPathDigest(input.signals.localPath);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Project
      const newProject = await tx.project.create({
        data: {
          tenantId,
          name: derivedName,
          slug: derivedSlug,
          description: `Automatically discovered via ${input.source.platform} (${primaryCandidate.type})`,
          status: "ACTIVE",
          creationSource: "AUTO_DISCOVERY",
        },
      });

      // 2. Create Primary Identity
      await tx.projectIdentity.create({
        data: {
          projectId: newProject.id,
          type: primaryCandidate.type,
          value: primaryCandidate.value,
          identityHash: primaryCandidate.hash,
          isPrimary: true,
          confidence: primaryCandidate.confidence,
        },
      });

      // 3. Create Secondary Identities (if any other signals provided)
      for (let i = 1; i < candidates.length; i++) {
        const secondary = candidates[i];
        if (secondary.hash !== primaryCandidate.hash) {
          await tx.projectIdentity.create({
            data: {
              projectId: newProject.id,
              type: secondary.type,
              value: secondary.value,
              identityHash: secondary.hash,
              isPrimary: false,
              confidence: secondary.confidence,
            },
          });
        }
      }

      // 4. Create Project Source
      await tx.projectSource.create({
        data: {
          projectId: newProject.id,
          platform: input.source.platform,
          externalId: input.source.externalId || null,
          localPathDigest: localPathDigest,
          metadata: (input.source.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      return newProject;
    });

    return {
      project: result,
      matchedBy: primaryCandidate.type,
      canonicalIdentity: primaryCandidate.value,
      confidence: primaryCandidate.confidence,
      isNewlyCreated: true,
    };
  } catch (error) {
    // --- 3. CONCURRENCY RACE CONDITION HANDLING ---
    // If another simultaneous process created the identical identity record just now:
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raceResolved = await prisma.projectIdentity.findUnique({
        where: {
          type_identityHash: {
            type: primaryCandidate.type,
            identityHash: primaryCandidate.hash,
          },
        },
        include: {
          project: true,
        },
      });

      if (raceResolved && raceResolved.project && raceResolved.project.tenantId === tenantId) {
        // Record source for this concurrent client
        await recordProjectSource(raceResolved.project.id, input.source, input.signals.localPath);

        return {
          project: raceResolved.project,
          matchedBy: primaryCandidate.type,
          canonicalIdentity: primaryCandidate.value,
          confidence: primaryCandidate.confidence,
          isNewlyCreated: false,
        };
      }
    }

    throw error;
  }
}

/**
 * Attaches additional candidate identities to an existing project if not already present.
 */
async function attachSecondaryIdentities(
  projectId: string,
  candidates: CandidateIdentity[],
  matchedHash: string
): Promise<void> {
  for (const candidate of candidates) {
    if (candidate.hash === matchedHash) continue;

    try {
      const existing = await prisma.projectIdentity.findUnique({
        where: {
          type_identityHash: {
            type: candidate.type,
            identityHash: candidate.hash,
          },
        },
      });

      if (!existing) {
        await prisma.projectIdentity.create({
          data: {
            projectId,
            type: candidate.type,
            value: candidate.value,
            identityHash: candidate.hash,
            isPrimary: false,
            confidence: candidate.confidence,
          },
        });
      }
    } catch {
      // Non-blocking: if another process attached it concurrently, ignore duplicate error
    }
  }
}

/**
 * Upserts or records platform activity under ProjectSource.
 */
async function recordProjectSource(
  projectId: string,
  source: ResolveProjectInput["source"],
  localPath?: string
): Promise<void> {
  const localPathDigest = generateLocalPathDigest(localPath);

  try {
    if (source.externalId) {
      const existingSource = await prisma.projectSource.findFirst({
        where: {
          projectId,
          platform: source.platform,
          externalId: source.externalId,
        },
      });

      if (existingSource) {
        await prisma.projectSource.update({
          where: { id: existingSource.id },
          data: {
            lastSeenAt: new Date(),
            ...(localPathDigest && { localPathDigest }),
            ...(source.metadata && {
              metadata: source.metadata as Prisma.InputJsonValue,
            }),
          },
        });
        return;
      }
    }

    await prisma.projectSource.create({
      data: {
        projectId,
        platform: source.platform,
        externalId: source.externalId || null,
        localPathDigest,
        metadata: (source.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch {
    // Non-blocking source logging
  }
}

/**
 * Retrieves all registered identities for a project.
 */
export async function getProjectIdentities(
  projectId: string
): Promise<ProjectIdentity[]> {
  return prisma.projectIdentity.findMany({
    where: { projectId },
    orderBy: [{ isPrimary: "desc" }, { confidence: "desc" }],
  });
}

/**
 * Retrieves all platform sources associated with a project.
 */
export async function getProjectSources(
  projectId: string
): Promise<ProjectSource[]> {
  return prisma.projectSource.findMany({
    where: { projectId },
    orderBy: { lastSeenAt: "desc" },
  });
}
