import { z } from "zod";

export const memoryTypeSchema = z.enum([
  "DECISION",
  "REQUIREMENT",
  "CONVENTION",
  "BUG_SOLUTION",
]);

export const memoryPrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
]);

export const memoryStatusSchema = z.enum([
  "ACTIVE",
  "DEPRECATED",
  "ARCHIVED",
]);

export const memoryIdSchema = z.string().uuid("Invalid memory UUID format");

export const createMemorySchema = z.object({
  projectId: z.string().uuid("Invalid project UUID format"),
  type: memoryTypeSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(10000, "Content cannot exceed 10,000 characters"),
  priority: memoryPrioritySchema.optional().default("NORMAL"),
  status: memoryStatusSchema.optional().default("ACTIVE"),
});

export const updateMemorySchema = z
  .object({
    type: memoryTypeSchema.optional(),
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    content: z
      .string()
      .trim()
      .min(1, "Content cannot be empty")
      .max(10000, "Content cannot exceed 10,000 characters")
      .optional(),
    priority: memoryPrioritySchema.optional(),
    status: memoryStatusSchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided for update"
  );

export const listMemoriesFilterSchema = z.object({
  projectId: z.string().uuid("Invalid project UUID format"),
  type: memoryTypeSchema.optional(),
  priority: memoryPrioritySchema.optional(),
  status: memoryStatusSchema.optional(),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type ListMemoriesFilter = z.infer<typeof listMemoriesFilterSchema>;
