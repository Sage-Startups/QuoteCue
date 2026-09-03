import { z } from "zod";

export const UNITS = ["HOUR", "DAY", "ITEM", "METRE", "SQUARE_METRE", "VISIT", "FIXED"] as const;
export const KINDS = ["LABOUR", "MATERIAL", "OTHER"] as const;

export const serviceRowSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(140),
  category: z.string().trim().max(80).default("General"),
  unit: z.enum(UNITS),
  kind: z.enum(KINDS),
  unitPrice: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a price such as 45.00").or(z.literal("")),
  internalCost: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a cost such as 20.00").or(z.literal("")),
  customerDescription: z.string().trim().max(600).default(""),
});

export type ServiceRow = z.infer<typeof serviceRowSchema>;

export const tradeTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(400),
  icon: z.string().trim().max(40),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  defaultScope: z.string().trim().max(4000),
  defaultTerms: z.string().trim().max(4000),
  commonExclusions: z.string().max(4000),
  commonQuestions: z.string().max(4000),
  defaultAssumptions: z.string().max(4000),
  suggestedServices: z.array(serviceRowSchema).max(100),
});

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only");
