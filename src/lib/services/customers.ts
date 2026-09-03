import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normaliseEmail, normalisePhone } from "@/lib/utils/strings";
import { NotFoundError } from "@/lib/utils/result";

export const customerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  preferredContactMethod: z.enum(["EMAIL", "PHONE", "SMS", "WHATSAPP"]).default("EMAIL"),
  billingAddressLine1: z.string().trim().max(120).optional().or(z.literal("")),
  billingAddressLine2: z.string().trim().max(120).optional().or(z.literal("")),
  billingCity: z.string().trim().max(80).optional().or(z.literal("")),
  billingRegion: z.string().trim().max(80).optional().or(z.literal("")),
  billingPostalCode: z.string().trim().max(20).optional().or(z.literal("")),
  billingCountry: z.string().trim().max(2).optional().or(z.literal("")),
  jobAddressSameAsBilling: z.coerce.boolean().default(true),
  jobAddressLine1: z.string().trim().max(120).optional().or(z.literal("")),
  jobAddressLine2: z.string().trim().max(120).optional().or(z.literal("")),
  jobCity: z.string().trim().max(80).optional().or(z.literal("")),
  jobRegion: z.string().trim().max(80).optional().or(z.literal("")),
  jobPostalCode: z.string().trim().max(20).optional().or(z.literal("")),
  jobCountry: z.string().trim().max(2).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CustomerInput = z.infer<typeof customerSchema>;

function nullable(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

function buildData(input: CustomerInput) {
  const job = input.jobAddressSameAsBilling
    ? {
        jobAddressLine1: nullable(input.billingAddressLine1),
        jobAddressLine2: nullable(input.billingAddressLine2),
        jobCity: nullable(input.billingCity),
        jobRegion: nullable(input.billingRegion),
        jobPostalCode: nullable(input.billingPostalCode),
        jobCountry: nullable(input.billingCountry)?.toUpperCase() ?? null,
      }
    : {
        jobAddressLine1: nullable(input.jobAddressLine1),
        jobAddressLine2: nullable(input.jobAddressLine2),
        jobCity: nullable(input.jobCity),
        jobRegion: nullable(input.jobRegion),
        jobPostalCode: nullable(input.jobPostalCode),
        jobCountry: nullable(input.jobCountry)?.toUpperCase() ?? null,
      };
  return {
    type: input.type,
    contactName: input.contactName,
    companyName: input.type === "COMPANY" ? nullable(input.companyName) : nullable(input.companyName),
    email: input.email ? normaliseEmail(input.email) : null,
    phone: nullable(input.phone),
    preferredContactMethod: input.preferredContactMethod,
    billingAddressLine1: nullable(input.billingAddressLine1),
    billingAddressLine2: nullable(input.billingAddressLine2),
    billingCity: nullable(input.billingCity),
    billingRegion: nullable(input.billingRegion),
    billingPostalCode: nullable(input.billingPostalCode),
    billingCountry: nullable(input.billingCountry)?.toUpperCase() ?? null,
    internalNotes: nullable(input.internalNotes),
    ...job,
  };
}

async function syncTags(workspaceId: string, customerId: string, tags: string[]) {
  const names = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  const tagRows = await Promise.all(
    names.map((name) =>
      prisma.customerTag.upsert({ where: { workspaceId_name: { workspaceId, name } }, create: { workspaceId, name }, update: {}, select: { id: true } }),
    ),
  );
  await prisma.customerTagAssignment.deleteMany({ where: { customerId, tagId: { notIn: tagRows.map((t) => t.id) } } });
  for (const tag of tagRows) {
    await prisma.customerTagAssignment.upsert({ where: { customerId_tagId: { customerId, tagId: tag.id } }, create: { customerId, tagId: tag.id }, update: {} });
  }
}

/** Finds existing customers in the same workspace with a matching email or telephone. */
export async function findPossibleDuplicates(workspaceId: string, email?: string | null, phone?: string | null, excludeId?: string) {
  const conditions: Prisma.CustomerWhereInput[] = [];
  if (email) conditions.push({ email: { equals: normaliseEmail(email), mode: "insensitive" } });
  if (phone) {
    const digits = normalisePhone(phone);
    if (digits.length >= 6) conditions.push({ phone: { contains: digits.slice(-8) } });
  }
  if (conditions.length === 0) return [];
  return prisma.customer.findMany({
    where: { workspaceId, archivedAt: null, id: excludeId ? { not: excludeId } : undefined, OR: conditions },
    select: { id: true, contactName: true, companyName: true, email: true, phone: true },
    take: 5,
  });
}

export async function createCustomer(workspaceId: string, input: CustomerInput) {
  const customer = await prisma.customer.create({ data: { workspaceId, ...buildData(input) }, select: { id: true } });
  await syncTags(workspaceId, customer.id, input.tags);
  return customer;
}

export async function updateCustomer(workspaceId: string, customerId: string, input: CustomerInput) {
  const existing = await prisma.customer.findFirst({ where: { id: customerId, workspaceId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Customer not found");
  await prisma.customer.update({ where: { id: customerId }, data: buildData(input) });
  await syncTags(workspaceId, customerId, input.tags);
}

export async function setCustomerArchived(workspaceId: string, customerId: string, archived: boolean) {
  const result = await prisma.customer.updateMany({ where: { id: customerId, workspaceId }, data: { archivedAt: archived ? new Date() : null } });
  if (result.count === 0) throw new NotFoundError("Customer not found");
}

export interface CustomerListParams {
  search?: string;
  tag?: string;
  archived?: boolean;
  type?: "INDIVIDUAL" | "COMPANY";
  page?: number;
  pageSize?: number;
}

export async function listCustomers(workspaceId: string, params: CustomerListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 25));
  const where: Prisma.CustomerWhereInput = {
    workspaceId,
    archivedAt: params.archived ? { not: null } : null,
    type: params.type,
    tags: params.tag ? { some: { tag: { name: params.tag } } } : undefined,
    OR: params.search
      ? [
          { contactName: { contains: params.search, mode: "insensitive" } },
          { companyName: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
          { phone: { contains: params.search } },
          { jobPostalCode: { contains: params.search, mode: "insensitive" } },
        ]
      : undefined,
  };
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: { include: { tag: true } }, _count: { select: { quotes: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomer(workspaceId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, workspaceId },
    include: {
      tags: { include: { tag: true } },
      quotes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true, status: true, totalMinor: true, currency: true, createdAt: true, sentAt: true } },
    },
  });
  if (!customer) throw new NotFoundError("Customer not found");
  return customer;
}

export async function listCustomerTags(workspaceId: string) {
  return prisma.customerTag.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, include: { _count: { select: { assignments: true } } } });
}

export async function searchCustomersForPicker(workspaceId: string, query: string) {
  return prisma.customer.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      OR: query
        ? [{ contactName: { contains: query, mode: "insensitive" } }, { companyName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }]
        : undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, contactName: true, companyName: true, email: true, phone: true, jobAddressLine1: true, jobCity: true, jobPostalCode: true },
  });
}

export function customerDisplayName(c: { contactName: string; companyName?: string | null }): string {
  return c.companyName ? `${c.companyName} (${c.contactName})` : c.contactName;
}

export function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(", ");
}
