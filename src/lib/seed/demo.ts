import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { calculateQuote } from "@/lib/quotes/pricing";
import { addDays } from "@/lib/utils/dates";
import { hashToken } from "@/lib/utils/tokens";
import { findTradeTemplate } from "@/lib/data/trade-templates";
import { deriveQuoteToken } from "@/lib/services/public-quote";
import type { QuoteStatus } from "@/generated/prisma/enums";

export const DEMO_WORKSPACE_SLUG = "northstar-electrical-demo";
export const DEMO_USER_EMAIL = "demo@northstar-electrical.example";

/** Deterministic pseudo-random generator so the demo data is stable between resets. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = [
  { contactName: "Dave Patterson", email: "dave.patterson@example.com", phone: "07700 900101", jobAddressLine1: "14 Elm Road", jobCity: "Leeds", jobPostalCode: "LS7 3AB", type: "INDIVIDUAL" as const, tags: ["Repeat customer"] },
  { contactName: "Priya Nair", email: "priya.nair@example.com", phone: "07700 900102", jobAddressLine1: "3 Orchard Close", jobCity: "Harrogate", jobPostalCode: "HG1 2CD", type: "INDIVIDUAL" as const, tags: [] },
  { contactName: "Tom Whitaker", companyName: "Whitaker Lettings", email: "tom@whitakerlettings.example.com", phone: "0113 496 0102", jobAddressLine1: "Unit 4, Riverside Park", jobCity: "Leeds", jobPostalCode: "LS10 1EF", type: "COMPANY" as const, tags: ["Landlord", "Repeat customer"] },
  { contactName: "Amara Okafor", email: "amara.okafor@example.com", phone: "07700 900104", jobAddressLine1: "27 Hawthorn Avenue", jobCity: "Wakefield", jobPostalCode: "WF1 4GH", type: "INDIVIDUAL" as const, tags: [] },
  { contactName: "Gary Lund", companyName: "Lund & Sons Bakery", email: "gary@lundbakery.example.com", phone: "0113 496 0105", jobAddressLine1: "88 High Street", jobCity: "Otley", jobPostalCode: "LS21 3IJ", type: "COMPANY" as const, tags: ["Commercial"] },
  { contactName: "Helen Marsh", email: "helen.marsh@example.com", phone: "07700 900106", jobAddressLine1: "5 Meadow View", jobCity: "Ilkley", jobPostalCode: "LS29 8KL", type: "INDIVIDUAL" as const, tags: [] },
  { contactName: "Sam Reynolds", email: "sam.reynolds@example.com", phone: "07700 900107", jobAddressLine1: "19 Station Road", jobCity: "Leeds", jobPostalCode: "LS12 5MN", type: "INDIVIDUAL" as const, tags: ["New build"] },
  { contactName: "Nadia Hussain", companyName: "Bright Start Nursery", email: "nadia@brightstart.example.com", phone: "0113 496 0108", jobAddressLine1: "2 School Lane", jobCity: "Bradford", jobPostalCode: "BD1 6OP", type: "COMPANY" as const, tags: ["Commercial"] },
  { contactName: "Colin Baxter", email: "colin.baxter@example.com", phone: "07700 900109", jobAddressLine1: "41 Beech Grove", jobCity: "Leeds", jobPostalCode: "LS16 7QR", type: "INDIVIDUAL" as const, tags: [] },
  { contactName: "Rachel Doyle", email: "rachel.doyle@example.com", phone: "07700 900110", jobAddressLine1: "7 Windmill Rise", jobCity: "Wetherby", jobPostalCode: "LS22 9ST", type: "INDIVIDUAL" as const, tags: ["Repeat customer"] },
];

const JOBS = [
  { title: "Living room sockets and hallway LED panel", items: [["Install double socket outlet", 2], ["Replace light fitting (customer supplied)", 1], ["Minor works certificate", 1]], enquiry: "Hi, need 2 double sockets putting in the front room either side of the fireplace and the hall light changing to an LED panel. Fuse box is in the garage. Can you do it before the end of the month?" },
  { title: "Consumer unit replacement", items: [["Consumer unit replacement", 1], ["Electrician labour", 2]], enquiry: "Our fuse board is the old plastic type and the tenant says it trips a lot. Can you quote to replace it?" },
  { title: "Kitchen downlights", items: [["Install LED downlight", 8], ["Cable and consumables", 2], ["Minor works certificate", 1]], enquiry: "Looking for 8 LED downlights in the kitchen ceiling to replace the strip light. Kitchen is about 4m x 3m." },
  { title: "EV charger installation", items: [["EV charger installation", 1], ["Electrical Installation Condition Report (EICR)", 1]], enquiry: "We've ordered an EV and need a 7kW charger on the driveway wall. Meter is at the front of the house." },
  { title: "Landlord EICR and remedials", items: [["Electrical Installation Condition Report (EICR)", 1], ["Replace light switch or socket faceplate", 4]], enquiry: "Need an EICR for a 2 bed flat for a new tenancy, plus a few cracked faceplates replacing." },
  { title: "Bathroom extractor fan", items: [["Extractor fan installation", 1], ["Electrician labour", 1]], enquiry: "Bathroom has no fan and we're getting condensation. Can you fit one vented outside?" },
  { title: "Garden office supply", items: [["Electrician labour", 6], ["Cable and consumables", 4], ["Minor works certificate", 1]], enquiry: "Just had a garden office built, needs power and a couple of sockets and a light. About 15m from the house." },
  { title: "Shop lighting upgrade", items: [["Install LED downlight", 14], ["Electrician labour", 4], ["Minor works certificate", 1]], enquiry: "Bakery front-of-house lighting is dim and old. Want to upgrade to LED panels, roughly 14 fittings." },
  { title: "Outdoor security lights", items: [["Replace light fitting (customer supplied)", 2], ["Electrician labour", 2]], enquiry: "Two PIR floodlights on the back of the house please, we'll buy the lights." },
  { title: "Nursery emergency lighting test and repairs", items: [["Electrician labour", 3], ["Cable and consumables", 1]], enquiry: "Annual emergency lighting check for the nursery plus replacing any failed units." },
];

const MESSAGES = ["Thanks for getting in touch. Happy to help with this.", "Thanks for the photos, they were really useful.", "Following our phone call, here is the quote as discussed."];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

/**
 * Creates (or recreates) the Northstar Electrical Services demo workspace with
 * customers, catalogue, quotes and three months of relative-dated activity.
 * All figures are demonstration data.
 */
export async function seedDemoWorkspace(options: { now?: Date; log?: (message: string) => void } = {}): Promise<{ workspaceId: string; userId: string }> {
  const now = options.now ?? new Date();
  const log = options.log ?? (() => undefined);
  const rand = mulberry32(20260901);

  // Remove any previous demo workspace and user.
  const existing = await prisma.workspace.findUnique({ where: { slug: DEMO_WORKSPACE_SLUG }, select: { id: true } });
  if (existing) await prisma.workspace.delete({ where: { id: existing.id } });
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL }, select: { id: true } });
  if (existingUser) await prisma.user.delete({ where: { id: existingUser.id } });

  const user = await prisma.user.create({
    data: { name: "Jamie Northstar", email: DEMO_USER_EMAIL, emailVerified: true, onboardingCompletedAt: addDays(now, -95), createdAt: addDays(now, -95) },
  });
  const trade = findTradeTemplate("electrician");
  const workspace = await prisma.workspace.create({
    data: {
      name: "Northstar Electrical Services",
      slug: DEMO_WORKSPACE_SLUG,
      ownerId: user.id,
      isDemo: true,
      aiCreditBalance: 12,
      createdAt: addDays(now, -95),
      members: { create: { userId: user.id, role: "ADMIN" } },
      settings: {
        create: {
          businessName: "Northstar Electrical Services",
          tradeSlug: "electrician",
          contactName: "Jamie Northstar",
          email: "hello@northstar-electrical.example",
          phone: "0113 496 0000",
          website: "northstar-electrical.example",
          addressLine1: "Unit 7, Kirkstall Works",
          city: "Leeds",
          region: "West Yorkshire",
          postalCode: "LS5 3AA",
          country: "GB",
          currency: "GBP",
          taxMode: "VAT",
          taxLabel: "VAT",
          taxRateBps: 2000,
          taxNumber: "GB 123 4567 89",
          pricingMode: "TAX_EXCLUSIVE",
          labourRateMinor: 5500,
          callOutFeeMinor: 4500,
          paymentTerms: "Payment is due within 14 days of the invoice date. A 25% deposit is required before materials are ordered for jobs over £500.",
          warrantyWording: "All workmanship is guaranteed for 12 months. Manufacturer warranties apply to supplied materials.",
          quoteValidityDays: 30,
          brandColor: "#0f1f3d",
          accentColor: "#d97706",
          quoteFooter: "Northstar Electrical Services · NICEIC registered (demonstration data)",
        },
      },
      quoteTemplates: {
        create: {
          name: "Electrician standard quote",
          tradeSlug: "electrician",
          scopeOfWork: trade.defaultScope,
          exclusions: trade.commonExclusions.map((e) => `- ${e}`).join("\n"),
          assumptions: trade.defaultAssumptions.map((a) => `- ${a}`).join("\n"),
          customerQuestions: trade.commonQuestions,
          paymentTerms: trade.defaultTerms,
          isDefault: true,
        },
      },
    },
  });

  const proPlan = await prisma.plan.findUniqueOrThrow({ where: { key: "PRO" } });
  await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      planId: proPlan.id,
      status: "ACTIVE",
      interval: "MONTH",
      stripeCustomerId: `cus_demo_${workspace.id.slice(0, 8)}`,
      stripeSubscriptionId: `sub_demo_${workspace.id.slice(0, 8)}`,
      currentPeriodStart: addDays(now, -12),
      currentPeriodEnd: addDays(now, 18),
    },
  });
  await prisma.creditLedgerEntry.create({ data: { workspaceId: workspace.id, type: "ADMIN_GRANT", delta: 12, balanceAfter: 12, reason: "Demo credits (sample data)", idempotencyKey: `demo:${workspace.id}` } });

  const catalogue = await Promise.all(
    trade.suggestedServices.map((s, idx) =>
      prisma.serviceCatalogueItem.create({
        data: { workspaceId: workspace.id, name: s.name, category: s.category, customerDescription: s.customerDescription ?? null, unit: s.unit, kind: s.kind, unitPriceMinor: s.unitPriceMinor, internalCostMinor: s.internalCostMinor, sortOrder: idx },
      }),
    ),
  );
  const catalogueByName = new Map(catalogue.map((c) => [c.name, c]));

  const customers = [];
  for (const c of CUSTOMERS) {
    const { tags, ...rest } = c;
    const customer = await prisma.customer.create({ data: { workspaceId: workspace.id, ...rest, billingAddressLine1: rest.jobAddressLine1, billingCity: rest.jobCity, billingPostalCode: rest.jobPostalCode, jobCountry: "GB", billingCountry: "GB", createdAt: addDays(now, -90 + Math.floor(rand() * 10)) } });
    for (const name of tags) {
      const tag = await prisma.customerTag.upsert({ where: { workspaceId_name: { workspaceId: workspace.id, name } }, create: { workspaceId: workspace.id, name }, update: {} });
      await prisma.customerTagAssignment.create({ data: { customerId: customer.id, tagId: tag.id } });
    }
    customers.push(customer);
  }

  // Three months of activity: [created, sent, accepted] per month, oldest first.
  const months = [
    { created: 18, sent: 13, accepted: 8, startDaysAgo: 90, endDaysAgo: 61 },
    { created: 24, sent: 19, accepted: 12, startDaysAgo: 60, endDaysAgo: 31 },
    { created: 31, sent: 25, accepted: 17, startDaysAgo: 30, endDaysAgo: 1 },
  ];
  let sequence = 1;
  let quoteCount = 0;
  for (const month of months) {
    const days = month.startDaysAgo - month.endDaysAgo;
    for (let i = 0; i < month.created; i++) {
      const createdAt = addDays(now, -(month.startDaysAgo - Math.floor((i / month.created) * days) - Math.floor(rand() * 2)));
      createdAt.setUTCHours(8 + Math.floor(rand() * 9), Math.floor(rand() * 60), 0, 0);
      const isSent = i < month.sent;
      const isAccepted = i < month.accepted;
      const isDeclined = isSent && !isAccepted && rand() < 0.3;
      const isViewed = isSent && !isAccepted && !isDeclined && rand() < 0.6;
      const job = pick(rand, JOBS);
      const customer = pick(rand, customers);
      const sentAt = isSent ? new Date(createdAt.getTime() + (2 + rand() * 40) * 3_600_000) : null;
      const viewedAt = sentAt && (isAccepted || isDeclined || isViewed) ? new Date(sentAt.getTime() + (1 + rand() * 30) * 3_600_000) : null;
      const decidedAt = viewedAt && (isAccepted || isDeclined) ? new Date(viewedAt.getTime() + (0.5 + rand() * 48) * 3_600_000) : null;
      const expiresAt = addDays(sentAt ?? createdAt, 30);
      let status: QuoteStatus = "DRAFT";
      if (isAccepted) status = "ACCEPTED";
      else if (isDeclined) status = "DECLINED";
      else if (isSent && expiresAt < now) status = "EXPIRED";
      else if (isViewed) status = "VIEWED";
      else if (isSent) status = "SENT";
      else if (rand() < 0.3) status = "READY";

      const lines = job.items.map(([name, qty]) => {
        const item = catalogueByName.get(name as string)!;
        return { item, quantity: qty as number };
      });
      const priced = calculateQuote({
        lines: lines.map((l) => ({ quantity: l.quantity, unitPriceMinor: l.item.unitPriceMinor, discountType: "NONE", discountValue: 0, taxTreatment: "TAXABLE", internalCostMinor: l.item.internalCostMinor })),
        pricingMode: "TAX_EXCLUSIVE",
        taxRateBps: 2000,
        discountType: "NONE",
        discountValue: 0,
        callOutFeeMinor: 4500,
      });
      const number = `QC-${createdAt.getUTCFullYear()}-${String(sequence++).padStart(4, "0")}`;
      const quoteId = randomUUID();
      const token = deriveQuoteToken(quoteId, 1);
      const quote = await prisma.quote.create({
        data: {
          id: quoteId,
          workspaceId: workspace.id,
          customerId: customer.id,
          createdById: user.id,
          number,
          title: job.title,
          status,
          currency: "GBP",
          enquiryText: job.enquiry,
          jobNotes: isSent ? "Checked access and parking. Customer available weekdays." : null,
          jobAddressLine1: customer.jobAddressLine1,
          jobCity: customer.jobCity,
          jobPostalCode: customer.jobPostalCode,
          jobCountry: "GB",
          createdAt,
          updatedAt: decidedAt ?? viewedAt ?? sentAt ?? createdAt,
          issuedAt: sentAt,
          sentAt,
          firstViewedAt: viewedAt,
          lastViewedAt: viewedAt,
          viewCount: viewedAt ? 1 + Math.floor(rand() * 3) : 0,
          acceptedAt: isAccepted ? decidedAt : null,
          declinedAt: isDeclined ? decidedAt : null,
          expiresAt,
          expiredAt: status === "EXPIRED" ? expiresAt : null,
          readyAt: status === "READY" ? createdAt : null,
          followUpAt: sentAt ? addDays(sentAt, 3) : null,
          totalMinor: priced.totalMinor,
          wizardStep: isSent ? 7 : 4,
          publicTokenHash: isSent ? hashToken(token) : null,
          publicTokenExpiresAt: isSent ? addDays(sentAt!, 180) : null,
          aiAnalysisAt: createdAt,
          aiAnalysis: {
            jobSummary: job.enquiry,
            detectedTrade: "Electrician",
            suggestedWork: lines.map((l) => ({ description: l.item.name, detail: null, source: "message", confidence: "high", requiresConfirmation: false, kind: l.item.kind, matchedCatalogueItemId: l.item.id, matchedCatalogueItemName: l.item.name, matchConfidence: "high", quantity: l.quantity, quantitySource: "explicit", unit: l.item.unit })),
            uncertainties: [{ description: "Access and working hours to be confirmed.", source: "inference", confidence: "medium", requiresConfirmation: true }],
            missingInformation: ["Preferred start date"],
            customerQuestions: ["When would you like the work to start?", "Is there parking near the property?"],
            assumptions: ["Existing circuits have spare capacity and are in a safe condition."],
            photoObservations: [],
            safetyNotes: ["Existing wiring condition cannot be verified from messages; allow for testing before connection."],
            recommendOnsiteInspection: false,
            inspectionReason: null,
            readiness: { level: "needs_confirmation", explanation: "Confirm the start date with the customer before sending." },
          },
        },
      });
      const version = await prisma.quoteVersion.create({
        data: {
          workspaceId: workspace.id,
          quoteId: quote.id,
          versionNumber: 1,
          title: job.title,
          jobSummary: job.enquiry,
          scopeOfWork: `Northstar Electrical Services will carry out the following work:\n${lines.map((l) => `- ${l.item.name}${l.quantity > 1 ? ` (${l.quantity})` : ""}`).join("\n")}\n\nAll work will be tested and certified on completion and the working area left clean and tidy.`,
          includedWork: `${lines.map((l) => `- ${l.item.name}`).join("\n")}\n- Testing and certification\n- Removal of packaging and waste`,
          assumptions: "- Existing circuits have spare capacity and are in a safe condition\n- Cable routes are accessible without major making good",
          exclusions: "- Decorating and making good beyond filling chases\n- Replacement of existing circuits found to be unsafe (quoted separately)",
          customerResponsibilities: "- Provide access to the property on the agreed dates\n- Clear the working area of furniture and belongings",
          paymentTerms: "Payment is due within 14 days of the invoice date. A 25% deposit is required before materials are ordered for jobs over £500.",
          estimatedSchedule: "One working day. Start dates agreed on acceptance.",
          warrantyWording: "All workmanship is guaranteed for 12 months. Manufacturer warranties apply to supplied materials.",
          validityWording: "This quote is valid for 30 days from the issue date.",
          followUpEmail: `Hi ${customer.contactName.split(" ")[0]},\n\n${pick(rand, MESSAGES)} Please find your quote at the link below.\n\n[QUOTE LINK]\n\nKind regards,\nJamie\nNorthstar Electrical Services`,
          customerQuestions: ["When would you like the work to start?", "Is there parking near the property?"],
          pricingMode: "TAX_EXCLUSIVE",
          taxLabel: "VAT",
          taxRateBps: 2000,
          callOutFeeMinor: 4500,
          subtotalMinor: priced.subtotalMinor,
          discountMinor: priced.discountMinor,
          taxMinor: priced.taxMinor,
          totalMinor: priced.totalMinor,
          internalCostMinor: priced.internalCostMinor,
          isLocked: isAccepted,
          lockedAt: isAccepted ? decidedAt : null,
          createdAt,
          items: {
            create: lines.map((l, idx) => ({
              workspaceId: workspace.id,
              catalogueItemId: l.item.id,
              sortOrder: idx,
              kind: l.item.kind,
              description: l.item.name,
              customerDescription: l.item.customerDescription,
              quantity: l.quantity,
              unit: l.item.unit,
              unitPriceMinor: l.item.unitPriceMinor,
              internalCostMinor: l.item.internalCostMinor,
              lineSubtotalMinor: priced.lines[idx]!.lineSubtotalMinor,
              lineTotalMinor: priced.lines[idx]!.lineTotalMinor,
              aiSuggested: true,
            })),
          },
        },
      });
      await prisma.quote.update({ where: { id: quote.id }, data: { currentVersionId: version.id } });

      const events: Array<{ type: "CREATED" | "AI_ANALYSIS" | "AI_GENERATION" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "EXPIRED"; at: Date; actorType: "USER" | "CUSTOMER" | "SYSTEM"; message: string }> = [
        { type: "CREATED", at: createdAt, actorType: "USER", message: `Quote ${number} created` },
        { type: "AI_ANALYSIS", at: new Date(createdAt.getTime() + 120_000), actorType: "USER", message: "AI analysis completed" },
        { type: "AI_GENERATION", at: new Date(createdAt.getTime() + 600_000), actorType: "USER", message: "Quote wording generated" },
      ];
      if (sentAt) events.push({ type: "SENT", at: sentAt, actorType: "USER", message: `Quote sent to ${customer.email}` });
      if (viewedAt) events.push({ type: "VIEWED", at: viewedAt, actorType: "CUSTOMER", message: "Customer opened the quote" });
      if (isAccepted && decidedAt) events.push({ type: "ACCEPTED", at: decidedAt, actorType: "CUSTOMER", message: `Accepted by ${customer.contactName}` });
      if (isDeclined && decidedAt) events.push({ type: "DECLINED", at: decidedAt, actorType: "CUSTOMER", message: "Declined: going with another quote" });
      if (status === "EXPIRED") events.push({ type: "EXPIRED", at: expiresAt, actorType: "SYSTEM", message: "Quote expired" });
      await prisma.quoteEvent.createMany({ data: events.map((e) => ({ workspaceId: workspace.id, quoteId: quote.id, type: e.type, actorType: e.actorType, actorUserId: e.actorType === "USER" ? user.id : null, message: e.message, createdAt: e.at })) });
      if ((isAccepted || isDeclined) && decidedAt) {
        await prisma.quoteAcceptance.create({
          data: { workspaceId: workspace.id, quoteId: quote.id, versionId: version.id, decision: isAccepted ? "ACCEPTED" : "DECLINED", signedName: isAccepted ? customer.contactName : null, reason: isDeclined ? "Going with another quote" : null, termsAccepted: isAccepted, totalMinor: priced.totalMinor, createdAt: decidedAt },
        });
      }
      if (sentAt) {
        await prisma.emailEvent.create({ data: { workspaceId: workspace.id, userId: user.id, quoteId: quote.id, kind: "QUOTE_SENT", toEmail: customer.email ?? "customer@example.com", subject: `Your quote ${number} from Northstar Electrical Services`, status: "SENT", provider: "demo", createdAt: sentAt } });
      }
      await prisma.aiRun.createMany({
        data: [
          { workspaceId: workspace.id, userId: user.id, quoteId: quote.id, feature: "ENQUIRY_ANALYSIS", provider: "demo", model: "demo-fixture", status: "SUCCEEDED", inputTokens: 1800 + Math.floor(rand() * 600), outputTokens: 900 + Math.floor(rand() * 300), estimatedCostMicros: 2500, creditConsumed: true, startedAt: createdAt, completedAt: new Date(createdAt.getTime() + 9_000), durationMs: 9000 },
          { workspaceId: workspace.id, userId: user.id, quoteId: quote.id, feature: "QUOTE_WORDING", provider: "demo", model: "demo-fixture", status: "SUCCEEDED", inputTokens: 2200 + Math.floor(rand() * 600), outputTokens: 1400 + Math.floor(rand() * 400), estimatedCostMicros: 3600, creditConsumed: true, startedAt: new Date(createdAt.getTime() + 500_000), completedAt: new Date(createdAt.getTime() + 512_000), durationMs: 12000 },
        ],
      });
      quoteCount++;
    }
  }
  await prisma.quoteCounter.create({ data: { workspaceId: workspace.id, year: now.getUTCFullYear(), nextNumber: sequence } });
  log(`Demo workspace seeded with ${customers.length} customers, ${catalogue.length} catalogue items and ${quoteCount} quotes`);
  return { workspaceId: workspace.id, userId: user.id };
}
