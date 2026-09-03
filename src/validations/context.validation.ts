import { z } from "zod";
import { memoryTypeSchema } from "./memory.validation";
import { projectIdSchema } from "./project.validation";
import type { MemoryType } from "@prisma/client";

/**
 * Context budget configuration limits (in characters).
 */
export const CONTEXT_BUDGET_LIMITS = {
  MIN: 1000,
  MAX: 50000,
  DEFAULT: 8000,
} as const;

/**
 * Context generation options schema (domain level).
 */
export const contextOptionsSchema = z.object({
  budget: z
    .number()
    .int("Budget must be an integer")
    .min(
      CONTEXT_BUDGET_LIMITS.MIN,
      `Budget must be at least ${CONTEXT_BUDGET_LIMITS.MIN} characters`
    )
    .max(
      CONTEXT_BUDGET_LIMITS.MAX,
      `Budget must not exceed ${CONTEXT_BUDGET_LIMITS.MAX} characters`
    )
    .default(CONTEXT_BUDGET_LIMITS.DEFAULT),
  types: z.array(memoryTypeSchema).optional(),
});

export type ContextOptions = z.infer<typeof contextOptionsSchema>;

/**
 * Query parameter parsing schema for GET /api/projects/:projectId/context.
 * Parses raw query strings: ?budget=8000&types=DECISION,REQUIREMENT
 */
export const contextQuerySchema = z.object({
  budget: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (!val) return;
      const parsed = Number(val);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Budget query parameter must be a valid integer",
        });
        return;
      }
      if (parsed < CONTEXT_BUDGET_LIMITS.MIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Budget must be at least ${CONTEXT_BUDGET_LIMITS.MIN} characters`,
        });
      }
      if (parsed > CONTEXT_BUDGET_LIMITS.MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Budget must not exceed ${CONTEXT_BUDGET_LIMITS.MAX} characters`,
        });
      }
    })
    .transform((val) => {
      if (!val) return CONTEXT_BUDGET_LIMITS.DEFAULT;
      return Number(val);
    }),
  types: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (!val || val.trim() === "") return;
      const rawTypes = val.split(",").map((t) => t.trim());
      for (const t of rawTypes) {
        const check = memoryTypeSchema.safeParse(t);
        if (!check.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid memory type '${t}'. Allowed types: DECISION, REQUIREMENT, CONVENTION, BUG_SOLUTION.`,
          });
        }
      }
    })
    .transform((val) => {
      if (!val || val.trim() === "") return undefined;
      return val.split(",").map((t) => t.trim()) as MemoryType[];
    }),
});

export { projectIdSchema };
