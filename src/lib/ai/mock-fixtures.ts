/**
 * Keyword-driven fixtures for the mock AI provider. The fixtures are shaped to
 * satisfy the Zod schemas in ./schemas.ts and follow the same safety rules the
 * real prompts enforce (no invented prices, no claims about hidden conditions).
 */

interface CatalogueHint {
  id: string;
  name: string;
  unit?: string;
  kind?: string;
}

function findCatalogue(hints: CatalogueHint[], ...keywords: string[]): CatalogueHint | null {
  const lower = keywords.map((k) => k.toLowerCase());
  return hints.find((h) => lower.some((k) => h.name.toLowerCase().includes(k))) ?? null;
}

function num(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m) return null;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const raw = m[1]!.toLowerCase();
  const value = words[raw] ?? Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function buildMockFixture(schemaName: string, prompt: string, hint: Record<string, unknown>): unknown {
  const text = prompt.toLowerCase();
  const catalogue = (hint.catalogue as CatalogueHint[] | undefined) ?? [];
  const photoCount = Number(hint.photoCount ?? 0);
  switch (schemaName) {
    case "enquiry_analysis":
      return buildAnalysis(text, catalogue, photoCount);
    case "quote_wording":
      return buildWording(text, hint);
    case "section_regenerate":
      return { content: rewriteSection(String(hint.currentContent ?? ""), String(hint.sectionName ?? "section")) };
    case "image_analysis":
      return {
        description: "The photograph shows an interior wall with an existing white plastic socket outlet and painted plaster. Surface-mounted trunking is not visible.",
        observations: [
          { mediaIndex: 0, observation: "Existing single socket outlet on a plastered wall.", confidence: "medium", caveat: "Cable routing and condition behind the wall cannot be determined from the photograph." },
        ],
        visibleIssues: ["Socket faceplate appears discoloured."],
        caveats: ["No measurements can be taken from the image.", "Compliance of the existing installation cannot be assessed from a photograph."],
      };
    case "prompt_test":
      return { output: `Mock response (no API key configured). Received ${prompt.length} characters of input.` };
    default:
      return {};
  }
}

function buildAnalysis(text: string, catalogue: CatalogueHint[], photoCount: number) {
  const suggestedWork: unknown[] = [];
  const uncertainties: unknown[] = [];
  const missing: string[] = [];
  const questions: string[] = [];
  const assumptions: string[] = [];
  const photoObservations: unknown[] = [];
  const safetyNotes: string[] = [];
  let detectedTrade: string | null = null;
  let summary = "";
  let inspection = false;
  let inspectionReason: string | null = null;

  const isElectrical = /socket|light|lighting|consumer unit|fuse board|rewire|electric|spotlight|downlight|ev charger|extractor/.test(text);
  const isPlumbing = /leak|tap|boiler|radiator|bathroom|toilet|shower|pipe|drain|plumb/.test(text);
  const isPainting = /paint|decorat|wallpaper|emulsion|skirting/.test(text);
  const isLandscaping = /fence|patio|garden|turf|lawn|decking|hedge/.test(text);
  const isBuilding = /extension|wall|brick|plaster|roof|loft|kitchen fit|knock through/.test(text);

  if (isElectrical) {
    detectedTrade = "Electrician";
    const sockets = num(text, /(\w+)\s+(?:new\s+)?(?:double\s+)?sockets?/);
    const socketItem = findCatalogue(catalogue, "socket");
    if (/socket/.test(text)) {
      suggestedWork.push({
        description: "Install new double socket outlets",
        detail: "Chase in or surface mount as agreed, connect to existing ring final circuit, test and certify.",
        source: "message",
        confidence: sockets ? "high" : "medium",
        requiresConfirmation: !sockets,
        kind: "LABOUR",
        matchedCatalogueItemId: socketItem?.id ?? null,
        matchedCatalogueItemName: socketItem?.name ?? null,
        matchConfidence: socketItem ? "high" : null,
        quantity: sockets ?? null,
        quantitySource: sockets ? "explicit" : "unknown",
        unit: "ITEM",
      });
      if (!sockets) missing.push("Number of socket outlets required");
    }
    if (/light|spotlight|downlight|led/.test(text)) {
      const lightItem = findCatalogue(catalogue, "light", "downlight", "fitting");
      const lights = num(text, /(\w+)\s+(?:new\s+)?(?:led\s+)?(?:down)?lights?/);
      suggestedWork.push({
        description: "Replace or install light fittings",
        detail: "Supply and fit customer-approved fittings, connect to existing lighting circuit, test.",
        source: "message",
        confidence: "medium",
        requiresConfirmation: true,
        kind: "LABOUR",
        matchedCatalogueItemId: lightItem?.id ?? null,
        matchedCatalogueItemName: lightItem?.name ?? null,
        matchConfidence: lightItem ? "medium" : null,
        quantity: lights ?? null,
        quantitySource: lights ? "explicit" : "unknown",
        unit: "ITEM",
      });
      questions.push("Which light fittings would you like: supplied by us or your own?");
    }
    if (/consumer unit|fuse board/.test(text)) {
      const cuItem = findCatalogue(catalogue, "consumer unit");
      suggestedWork.push({
        description: "Inspect existing consumer unit and confirm circuit capacity",
        detail: "Required before adding circuits; replacement only if the board is non-compliant or full.",
        source: "inference",
        confidence: "medium",
        requiresConfirmation: true,
        kind: "LABOUR",
        matchedCatalogueItemId: cuItem?.id ?? null,
        matchedCatalogueItemName: cuItem?.name ?? null,
        matchConfidence: cuItem ? "medium" : null,
        quantity: 1,
        quantitySource: "estimated",
        unit: "ITEM",
      });
      inspection = true;
      inspectionReason = "The condition and capacity of the consumer unit cannot be confirmed without an on-site inspection.";
    }
    const certItem = findCatalogue(catalogue, "certificate", "testing");
    suggestedWork.push({
      description: "Electrical testing and certification for the new work",
      detail: "Minor works or installation certificate as applicable.",
      source: "inference",
      confidence: "high",
      requiresConfirmation: false,
      kind: "OTHER",
      matchedCatalogueItemId: certItem?.id ?? null,
      matchedCatalogueItemName: certItem?.name ?? null,
      matchConfidence: certItem ? "high" : null,
      quantity: 1,
      quantitySource: "estimated",
      unit: "ITEM",
    });
    safetyNotes.push("Existing wiring condition cannot be verified from messages or photographs; allow for testing before connection.");
    assumptions.push("Existing circuits have spare capacity and are in a safe condition.");
    assumptions.push("Cable routes are accessible without major making good.");
    summary = "Customer would like additional socket outlets and updated lighting. Work involves connecting to existing circuits, testing and certification.";
  } else if (isPlumbing) {
    detectedTrade = "Plumber";
    const item = findCatalogue(catalogue, "labour", "hour", "call");
    suggestedWork.push({
      description: "Investigate and repair reported leak",
      detail: "Locate source, isolate supply, replace failed fitting or section of pipework, test.",
      source: "message",
      confidence: "medium",
      requiresConfirmation: true,
      kind: "LABOUR",
      matchedCatalogueItemId: item?.id ?? null,
      matchedCatalogueItemName: item?.name ?? null,
      matchConfidence: item ? "medium" : null,
      quantity: null,
      quantitySource: "unknown",
      unit: "HOUR",
    });
    missing.push("Location and severity of the leak");
    questions.push("Is the leak constant or only when a tap or appliance is used?");
    inspection = true;
    inspectionReason = "The cause of a leak cannot be confirmed without seeing the pipework.";
    assumptions.push("Water can be isolated at the stopcock.");
    summary = "Customer reports a plumbing issue that needs investigation and repair.";
  } else if (isPainting) {
    detectedTrade = "Painter and decorator";
    const rooms = num(text, /(\w+)\s+(?:bed)?rooms?/);
    const item = findCatalogue(catalogue, "wall", "emulsion", "room");
    suggestedWork.push({
      description: "Prepare and paint walls and ceilings",
      detail: "Fill, sand, mist coat where required and apply two coats of emulsion.",
      source: "message",
      confidence: rooms ? "high" : "medium",
      requiresConfirmation: !rooms,
      kind: "LABOUR",
      matchedCatalogueItemId: item?.id ?? null,
      matchedCatalogueItemName: item?.name ?? null,
      matchConfidence: item ? "medium" : null,
      quantity: rooms ?? null,
      quantitySource: rooms ? "explicit" : "unknown",
      unit: "ITEM",
    });
    missing.push("Room dimensions or approximate wall area");
    questions.push("Have you chosen colours, or would you like us to supply paint?");
    assumptions.push("Walls are in sound condition and do not require re-plastering.");
    summary = "Customer wants interior decorating work carried out.";
  } else if (isLandscaping) {
    detectedTrade = "Landscaper";
    const metres = num(text, /(\d+)\s*(?:m|metre|meter)s?\b/);
    const item = findCatalogue(catalogue, "fence", "patio", "turf");
    suggestedWork.push({
      description: "Garden works as described",
      detail: "Clear area, prepare ground and install as agreed.",
      source: "message",
      confidence: "medium",
      requiresConfirmation: true,
      kind: "LABOUR",
      matchedCatalogueItemId: item?.id ?? null,
      matchedCatalogueItemName: item?.name ?? null,
      matchConfidence: item ? "medium" : null,
      quantity: metres,
      quantitySource: metres ? "explicit" : "unknown",
      unit: "METRE",
    });
    missing.push("Measurements of the area to be worked on");
    inspection = true;
    inspectionReason = "Ground conditions and access need to be checked on site.";
    summary = "Customer has requested garden or landscaping work.";
  } else {
    detectedTrade = isBuilding ? "Builder" : null;
    const item = findCatalogue(catalogue, "labour", "hour");
    suggestedWork.push({
      description: "Labour for work described in the enquiry",
      detail: "Scope to be confirmed with the customer.",
      source: "message",
      confidence: "low",
      requiresConfirmation: true,
      kind: "LABOUR",
      matchedCatalogueItemId: item?.id ?? null,
      matchedCatalogueItemName: item?.name ?? null,
      matchConfidence: item ? "low" : null,
      quantity: null,
      quantitySource: "unknown",
      unit: "HOUR",
    });
    missing.push("A clearer description of the work required");
    questions.push("Could you describe the work you need in a little more detail?");
    inspection = true;
    inspectionReason = "The enquiry does not contain enough detail to price without a site visit.";
    summary = "The enquiry describes work that needs further clarification before pricing.";
  }

  if (/material|supply/.test(text)) {
    const mat = findCatalogue(catalogue, "material");
    suggestedWork.push({
      description: "Materials for the above",
      detail: "Itemise once quantities are confirmed.",
      source: "inference",
      confidence: "medium",
      requiresConfirmation: true,
      kind: "MATERIAL",
      matchedCatalogueItemId: mat?.id ?? null,
      matchedCatalogueItemName: mat?.name ?? null,
      matchConfidence: mat ? "medium" : null,
      quantity: 1,
      quantitySource: "estimated",
      unit: "ITEM",
    });
  }

  uncertainties.push({ description: "Access to the property and working hours have not been confirmed.", source: "inference", confidence: "medium", requiresConfirmation: true });
  if (/urgent|asap|end of the month|before/.test(text)) {
    uncertainties.push({ description: "The customer has mentioned a deadline; availability should be confirmed.", source: "message", confidence: "high", requiresConfirmation: true });
    questions.push("When would you like the work to start, and are there any dates to avoid?");
  }
  if (!questions.some((q) => q.includes("parking"))) questions.push("Is there parking available near the property?");
  missing.push("Preferred start date");

  for (let i = 0; i < photoCount; i++) {
    photoObservations.push({
      mediaIndex: i,
      observation: i === 0 ? "The photograph shows the area where the work is requested; existing fittings and finishes are visible." : "Additional view of the work area.",
      confidence: "medium",
      caveat: "Photographs cannot confirm hidden conditions, measurements or compliance of existing installations.",
    });
  }

  const level = inspection ? "needs_inspection" : missing.length > 1 ? "needs_confirmation" : "ready";
  return {
    jobSummary: summary,
    detectedTrade,
    suggestedWork,
    uncertainties,
    missingInformation: missing,
    customerQuestions: questions,
    assumptions,
    photoObservations,
    safetyNotes,
    recommendOnsiteInspection: inspection,
    inspectionReason,
    readiness: {
      level,
      explanation:
        level === "ready"
          ? "The enquiry contains enough detail to prepare a quote; confirm quantities with the customer before sending."
          : level === "needs_confirmation"
            ? "Some quantities and preferences are missing; confirm them with the customer or state clear assumptions."
            : "An on-site inspection is recommended before committing to a fixed price.",
    },
  };
}

function buildWording(text: string, hint: Record<string, unknown>) {
  const business = String(hint.businessName ?? "our team");
  const customer = String(hint.customerName ?? "there");
  const summary = String(hint.jobSummary ?? "the work described in your enquiry");
  const lineItems = String(hint.lineItems ?? "");
  const lines = lineItems
    .split("\n")
    .map((l) => l.split("|")[0]?.trim())
    .filter((l): l is string => !!l);
  const included = lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : "- All labour and materials listed in the quote items";
  const isElectrical = /socket|light|electric|consumer unit/.test(text);
  return {
    title: isElectrical ? "Electrical works" : "Quotation for works",
    jobSummary: summary,
    scopeOfWork: `${business} will carry out the following work as described in your enquiry:\n${included}\n\nAll work will be carried out to a professional standard and the working area will be left clean and tidy on completion.`,
    includedWork: `${included}\n- Testing and checking of completed work\n- Removal of packaging and general waste created by the work`,
    assumptions:
      String(hint.assumptionsInput ?? "").trim() ||
      "- Clear access to the working area is available on the agreed dates\n- Existing services and structures are in a sound condition\n- Work can be completed during normal working hours",
    exclusions:
      String(hint.exclusionsInput ?? "").trim() ||
      "- Decorating or making good beyond what is stated\n- Work required due to unforeseen conditions discovered once work starts (a separate quote will be provided)\n- Removal of hazardous materials",
    customerResponsibilities: "- Provide access to the property and the relevant areas\n- Clear furniture and belongings from the working area\n- Confirm any choices of fittings or finishes before work starts",
    paymentTerms: String(hint.paymentTermsDefault ?? "Payment is due within 14 days of the invoice date."),
    estimatedSchedule: "We estimate the work will take one to two working days. Start dates will be agreed once the quote is accepted.",
    warrantyWording: String(hint.warrantyDefault ?? "Our workmanship is guaranteed for 12 months from completion. Manufacturer warranties apply to supplied materials."),
    validityWording: `This quote is valid for ${String(hint.validityDays ?? 30)} days from the issue date.`,
    followUpEmail: `Hi ${customer},\n\nThanks for getting in touch. Please find your quote for ${summary.toLowerCase().replace(/\.$/, "")} at the link below.\n\n[QUOTE LINK]\n\nYou can accept the quote online or reply to this email with any questions.\n\nKind regards,\n${business}`,
    customerQuestions: Array.isArray(hint.customerQuestions) ? (hint.customerQuestions as string[]).slice(0, 5) : [],
  };
}

function rewriteSection(current: string, section: string): string {
  const trimmed = current.trim();
  if (!trimmed) return `Please add the ${section} details for this quote.`;
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((l) => l.startsWith("-"))) {
    return lines.map((l) => l.replace(/\s+/g, " ")).join("\n");
  }
  return `${trimmed.replace(/\s+/g, " ").replace(/\.$/, "")}. We will keep you informed at every stage and confirm any changes with you before proceeding.`;
}
