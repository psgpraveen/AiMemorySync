import { z } from "zod";

export const projectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const projectIdSchema = z.string().uuid("Invalid project UUID format");

export const projectSlugSchema = z
  .string()
  .trim()
  .min(1, "Project slug is required")
  .max(100, "Slug cannot exceed 100 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase alphanumeric characters separated by single hyphens, with no leading or trailing hyphens"
  );

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(100, "Project name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug cannot be empty")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric characters separated by single hyphens, with no leading or trailing hyphens"
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1,000 characters")
    .nullable()
    .optional(),
  status: projectStatusSchema.optional().default("ACTIVE"),
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Project name cannot be empty")
      .max(100, "Project name cannot exceed 100 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Slug cannot be empty")
      .max(100, "Slug cannot exceed 100 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase alphanumeric characters separated by single hyphens, with no leading or trailing hyphens"
      )
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1,000 characters")
      .nullable()
      .optional(),
    status: projectStatusSchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided for update"
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
