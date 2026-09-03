import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createUser, createWorkspace, cleanupWorkspace } from "./helpers";
import { createCustomer, getCustomer, updateCustomer, listCustomers } from "@/lib/services/customers";
import { createQuote, getQuote, saveLineItems, createRevision, archiveQuote } from "@/lib/services/quotes";
import { getPublicQuoteByToken, ensurePublicLink, recordCustomerDecision } from "@/lib/services/public-quote";
import { signedDownloadUrl } from "@/lib/services/uploads";
import { NotFoundError } from "@/lib/utils/result";

let userA: { id: string };
let userB: { id: string };
let wsA: string;
let wsB: string;

beforeAll(async () => {
  userA = await createUser("Alice A");
  userB = await createUser("Bob B");
  wsA = await createWorkspace(userA.id, "Alice Electrical");
  wsB = await createWorkspace(userB.id, "Bob Plumbing");
});

afterAll(async () => {
  await cleanupWorkspace(wsA);
  await cleanupWorkspace(wsB);
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
});

const customerInput = {
  type: "INDIVIDUAL" as const,
  contactName: "Dave",
  companyName: "",
  email: "dave@example.com",
  phone: "07700900101",
  preferredContactMethod: "EMAIL" as const,
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingCity: "",
  billingRegion: "",
  billingPostalCode: "",
  billingCountry: "",
  jobAddressSameAsBilling: true,
  jobAddressLine1: "",
  jobAddressLine2: "",
  jobCity: "",
  jobRegion: "",
  jobPostalCode: "",
  jobCountry: "",
  internalNotes: "",
  tags: ["VIP"],
};

describe("workspace isolation", () => {
  it("does not expose another workspace's customer by direct id", async () => {
    const customer = await createCustomer(wsA, customerInput);
    await expect(getCustomer(wsB, customer.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateCustomer(wsB, customer.id, customerInput)).rejects.toBeInstanceOf(NotFoundError);
    const listB = await listCustomers(wsB, {});
    expect(listB.items.find((c) => c.id === customer.id)).toBeUndefined();
    const ok = await getCustomer(wsA, customer.id);
    expect(ok.tags[0]?.tag.name).toBe("VIP");
  });

  it("does not expose another workspace's quote, file or analytics", async () => {
    const quote = await createQuote({ workspaceId: wsA, userId: userA.id });
    await expect(getQuote(wsB, quote.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveQuote(wsB, quote.id, userB.id)).rejects.toBeInstanceOf(NotFoundError);
    const obj = await prisma.storedObject.create({ data: { workspaceId: wsA, key: `test/${quote.id}.txt`, bucket: "memory", purpose: "QUOTE_DOCUMENT", mimeType: "text/plain", sizeBytes: 3 } });
    await expect(signedDownloadUrl(obj.id, { workspaceId: wsB })).rejects.toBeInstanceOf(NotFoundError);
    const { getWorkspaceStats } = await import("@/lib/services/analytics");
    const statsB = await getWorkspaceStats(wsB, "90d");
    expect(statsB.current.quotesCreated).toBe(0);
  });

  it("assigns quote numbers atomically without duplicates", async () => {
    const created = await Promise.all(Array.from({ length: 8 }, () => createQuote({ workspaceId: wsA, userId: userA.id })));
    const numbers = new Set(created.map((q) => q.number));
    expect(numbers.size).toBe(8);
    expect([...numbers].every((n) => /^QC-\d{4}-\d{4}$/.test(n))).toBe(true);
  });

  it("prices quotes on the server, preserves accepted versions and supports revisions", async () => {
    const customer = await createCustomer(wsA, { ...customerInput, email: "accept@example.com" });
    const quote = await createQuote({ workspaceId: wsA, userId: userA.id, basics: { customerId: customer.id, title: "Sockets" } });
    const result = await saveLineItems(
      wsA,
      quote.id,
      userA.id,
      [{ description: "Install socket", quantity: "2", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 9500, discountType: "NONE", discountValue: 0, taxTreatment: "TAXABLE", internalCostMinor: 3500, catalogueItemId: null, isOptional: false, aiSuggested: false }],
      { pricingMode: "TAX_EXCLUSIVE", taxRateBps: 2000, taxLabel: "VAT", discountType: "NONE", discountValue: 0, callOutFeeMinor: 4500, callOutFeeLabel: "Call-out", depositTerms: "", internalNotes: "secret" },
    );
    expect(result.totalMinor).toBe(28200);
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT", sentAt: new Date(), issuedAt: new Date() } });
    const link = await ensurePublicLink(wsA, quote.id);
    const publicView = await getPublicQuoteByToken(link.token);
    expect(publicView?.document.totals.totalMinor).toBe(28200);
    expect(JSON.stringify(publicView?.document)).not.toContain("secret");
    expect(JSON.stringify(publicView?.document)).not.toContain("internalCost");
    await recordCustomerDecision(link.token, { decision: "ACCEPTED", signedName: "Dave Customer", termsAccepted: true, reason: "" }, { ipHash: null, userAgent: "vitest" });
    const accepted = await getQuote(wsA, quote.id);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.currentVersion?.isLocked).toBe(true);
    await expect(saveLineItems(wsA, quote.id, userA.id, [], { pricingMode: "NO_TAX", taxRateBps: 0, taxLabel: "Tax", discountType: "NONE", discountValue: 0, callOutFeeMinor: 0, callOutFeeLabel: "", depositTerms: "", internalNotes: "" })).rejects.toThrow(/locked/);
    const revision = await createRevision(wsA, quote.id, userA.id);
    expect(revision.versionNumber).toBe(2);
    const after = await getQuote(wsA, quote.id);
    expect(after.status).toBe("DRAFT");
    expect(after.versions.find((v) => v.versionNumber === 1)?.isLocked).toBe(true);
    expect(after.acceptances.length).toBe(1);
    // Second decision on the same token must fail (not open for decision).
    await expect(recordCustomerDecision(link.token, { decision: "DECLINED", signedName: "", termsAccepted: false, reason: "changed" }, { ipHash: null, userAgent: null })).rejects.toThrow();
  });

  it("rejects public tokens that do not match a hash and expires links", async () => {
    expect(await getPublicQuoteByToken("nope")).toBeNull();
    const quote = await createQuote({ workspaceId: wsA, userId: userA.id });
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT", sentAt: new Date() } });
    const link = await ensurePublicLink(wsA, quote.id);
    await prisma.quote.update({ where: { id: quote.id }, data: { publicTokenExpiresAt: new Date(Date.now() - 1000) } });
    const view = await getPublicQuoteByToken(link.token);
    expect(view?.linkExpired).toBe(true);
    expect(view?.canDecide).toBe(false);
  });
});
