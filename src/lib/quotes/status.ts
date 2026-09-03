import type { QuoteStatus } from "@/generated/prisma/enums";

/** Allowed status transitions. Accepted quotes are final except for revision. */
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["READY", "SENT", "ARCHIVED"],
  READY: ["DRAFT", "SENT", "ARCHIVED"],
  SENT: ["VIEWED", "ACCEPTED", "DECLINED", "EXPIRED", "ARCHIVED", "DRAFT"],
  VIEWED: ["ACCEPTED", "DECLINED", "EXPIRED", "ARCHIVED", "SENT", "DRAFT"],
  ACCEPTED: ["ARCHIVED"],
  DECLINED: ["ARCHIVED", "DRAFT"],
  EXPIRED: ["ARCHIVED", "SENT", "DRAFT"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move a quote from ${from.toLowerCase()} to ${to.toLowerCase()}`);
  }
}

export const EDITABLE_STATUSES: QuoteStatus[] = ["DRAFT", "READY", "SENT", "VIEWED", "EXPIRED", "DECLINED"];

export function isEditable(status: QuoteStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isOpenForDecision(status: QuoteStatus, expiresAt: Date | null, now = new Date()): boolean {
  if (!["SENT", "VIEWED"].includes(status)) return false;
  if (expiresAt && expiresAt.getTime() < now.getTime()) return false;
  return true;
}

export function computeExpired(status: QuoteStatus, expiresAt: Date | null, now = new Date()): boolean {
  return ["SENT", "VIEWED"].includes(status) && !!expiresAt && expiresAt.getTime() < now.getTime();
}

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};
