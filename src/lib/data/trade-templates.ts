/**
 * Editable example catalogues and wording for several trades. These seed the
 * TradeTemplate table and are used during onboarding to build a starting
 * service catalogue. Prices are examples only and are always editable.
 */

export interface TradeServiceSeed {
  name: string;
  category: string;
  unit: "HOUR" | "DAY" | "ITEM" | "METRE" | "SQUARE_METRE" | "VISIT" | "FIXED";
  kind: "LABOUR" | "MATERIAL" | "OTHER";
  unitPriceMinor: number;
  internalCostMinor: number;
  description?: string;
  customerDescription?: string;
}

export interface TradeTemplateSeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  suggestedServices: TradeServiceSeed[];
  defaultScope: string;
  commonExclusions: string[];
  commonQuestions: string[];
  defaultAssumptions: string[];
  defaultTerms: string;
  sortOrder: number;
}

const GENERIC_TERMS =
  "Payment is due within 14 days of the invoice date. A deposit may be requested before materials are ordered. Any additional work not covered by this quote will be agreed in writing before it is carried out.";

export const TRADE_TEMPLATES: TradeTemplateSeed[] = [
  {
    slug: "electrician",
    name: "Electrician",
    description: "Domestic and light commercial electrical work.",
    icon: "zap",
    sortOrder: 1,
    suggestedServices: [
      { name: "Electrician labour", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 5500, internalCostMinor: 2500 },
      { name: "Call-out and diagnostic visit", category: "Labour", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 8500, internalCostMinor: 3000 },
      { name: "Install double socket outlet", category: "Sockets & switches", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 3500, customerDescription: "Supply and install a new double socket on the existing circuit, including testing." },
      { name: "Replace light switch or socket faceplate", category: "Sockets & switches", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 4500, internalCostMinor: 1500 },
      { name: "Install LED downlight", category: "Lighting", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 2200 },
      { name: "Replace light fitting (customer supplied)", category: "Lighting", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 5500, internalCostMinor: 1800 },
      { name: "Consumer unit replacement", category: "Consumer units", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 65000, internalCostMinor: 32000, customerDescription: "Replace the existing consumer unit with a new metal-clad unit with RCBO protection, including testing and certification." },
      { name: "Electrical Installation Condition Report (EICR)", category: "Testing & certification", unit: "FIXED", kind: "OTHER", unitPriceMinor: 18000, internalCostMinor: 6000 },
      { name: "Minor works certificate", category: "Testing & certification", unit: "ITEM", kind: "OTHER", unitPriceMinor: 4500, internalCostMinor: 500 },
      { name: "EV charger installation", category: "EV charging", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 45000, internalCostMinor: 20000 },
      { name: "Cable and consumables", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 2500, internalCostMinor: 1500 },
      { name: "Extractor fan installation", category: "Ventilation", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 16000, internalCostMinor: 7000 },
    ],
    defaultScope: "All electrical work will be carried out in accordance with BS 7671 and certified on completion. Circuits will be tested before and after the work.",
    commonExclusions: ["Making good of plaster and decoration beyond filling chases", "Replacement of existing circuits found to be unsafe (quoted separately)", "Building control notification fees unless stated"],
    commonQuestions: ["Where is the consumer unit located?", "Are the walls solid or stud partition?", "Would you like fittings supplied by us or will you supply them?"],
    defaultAssumptions: ["The existing installation is in a safe and serviceable condition", "There is spare capacity on the consumer unit for any new circuits"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "plumber",
    name: "Plumber",
    description: "Domestic plumbing, bathrooms and repairs.",
    icon: "droplets",
    sortOrder: 2,
    suggestedServices: [
      { name: "Plumber labour", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 5500, internalCostMinor: 2500 },
      { name: "Emergency call-out", category: "Labour", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 12000, internalCostMinor: 4000 },
      { name: "Replace tap (customer supplied)", category: "Repairs", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 7500, internalCostMinor: 2500 },
      { name: "Repair leak on pipework", category: "Repairs", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 3000 },
      { name: "Replace toilet cistern internals", category: "Repairs", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 8500, internalCostMinor: 3500 },
      { name: "Install radiator", category: "Heating", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 18000, internalCostMinor: 7000 },
      { name: "Bathroom suite installation", category: "Bathrooms", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 120000, internalCostMinor: 60000 },
      { name: "Shower installation", category: "Bathrooms", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 45000, internalCostMinor: 20000 },
      { name: "Outside tap installation", category: "Installations", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 15000, internalCostMinor: 6000 },
      { name: "Pipework and fittings", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 3500, internalCostMinor: 2000 },
    ],
    defaultScope: "All plumbing work will be carried out to current water regulations. Supplies will be isolated and tested on completion.",
    commonExclusions: ["Tiling, decoration and making good", "Repairs to pipework found to be defective beyond the area of work", "Removal of asbestos-containing materials"],
    commonQuestions: ["Where is the stopcock located?", "Have you chosen the fittings or would you like recommendations?", "Is the property occupied during the work?"],
    defaultAssumptions: ["Existing pipework is in a serviceable condition", "Water can be isolated at the property"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "builder",
    name: "Builder",
    description: "Extensions, alterations and general building.",
    icon: "hammer",
    sortOrder: 3,
    suggestedServices: [
      { name: "General builder labour", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 28000, internalCostMinor: 16000 },
      { name: "Labourer", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 18000, internalCostMinor: 11000 },
      { name: "Brickwork", category: "Structural", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 5000 },
      { name: "Plastering", category: "Finishing", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 3500, internalCostMinor: 1800 },
      { name: "Structural opening with steel beam", category: "Structural", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 250000, internalCostMinor: 140000 },
      { name: "Skip hire", category: "Site", unit: "ITEM", kind: "OTHER", unitPriceMinor: 32000, internalCostMinor: 26000 },
      { name: "Scaffolding", category: "Site", unit: "FIXED", kind: "OTHER", unitPriceMinor: 90000, internalCostMinor: 75000 },
      { name: "Materials allowance", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 10000, internalCostMinor: 8000 },
    ],
    defaultScope: "Work will be carried out in accordance with the agreed drawings and current building regulations. The site will be kept safe and tidy throughout.",
    commonExclusions: ["Architect and structural engineer fees", "Building control and planning fees", "Unforeseen ground conditions"],
    commonQuestions: ["Do you have drawings or a structural engineer's specification?", "Has planning permission been obtained if required?", "Is there space for a skip?"],
    defaultAssumptions: ["Access for deliveries and a skip is available", "No asbestos or contaminated materials are present"],
    defaultTerms: "Payment is by staged invoices as work progresses. A deposit of 20% is required to secure a start date. Retention of 5% may be held until snagging is complete.",
  },
  {
    slug: "painter-decorator",
    name: "Painter and decorator",
    description: "Interior and exterior decorating.",
    icon: "paintbrush",
    sortOrder: 4,
    suggestedServices: [
      { name: "Decorator labour", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 22000, internalCostMinor: 12000 },
      { name: "Paint walls and ceiling (per room)", category: "Interior", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 32000, internalCostMinor: 16000, customerDescription: "Prepare surfaces, fill minor defects and apply two coats of emulsion to walls and ceiling." },
      { name: "Paint woodwork (per room)", category: "Interior", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 18000, internalCostMinor: 9000 },
      { name: "Wallpaper hanging", category: "Interior", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 2200, internalCostMinor: 1100 },
      { name: "Exterior masonry painting", category: "Exterior", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 1800, internalCostMinor: 900 },
      { name: "Paint and materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 6000, internalCostMinor: 4500 },
    ],
    defaultScope: "All surfaces will be prepared, filled and sanded as required before painting. Furniture and floors will be protected with dust sheets.",
    commonExclusions: ["Moving heavy furniture", "Re-plastering of damaged walls", "Removal of old wallpaper unless stated"],
    commonQuestions: ["Have you chosen colours and finishes?", "Are the rooms empty or occupied?", "Is there any existing wallpaper to remove?"],
    defaultAssumptions: ["Walls are in sound condition and need only minor filling", "Customer will clear small items from the rooms"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "landscaper",
    name: "Landscaper",
    description: "Gardens, patios, fencing and outdoor spaces.",
    icon: "trees",
    sortOrder: 5,
    suggestedServices: [
      { name: "Landscaper labour", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 24000, internalCostMinor: 13000 },
      { name: "Fence panel supply and install", category: "Fencing", unit: "METRE", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 5500 },
      { name: "Patio laying", category: "Hard landscaping", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 12000, internalCostMinor: 7000 },
      { name: "Turf laying", category: "Soft landscaping", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 2500, internalCostMinor: 1400 },
      { name: "Decking", category: "Hard landscaping", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 14000, internalCostMinor: 8000 },
      { name: "Garden clearance", category: "Maintenance", unit: "DAY", kind: "LABOUR", unitPriceMinor: 26000, internalCostMinor: 15000 },
      { name: "Waste removal", category: "Site", unit: "ITEM", kind: "OTHER", unitPriceMinor: 18000, internalCostMinor: 14000 },
      { name: "Aggregates and materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 8000, internalCostMinor: 6500 },
    ],
    defaultScope: "The area will be cleared and prepared before installation. Levels and drainage will be considered throughout.",
    commonExclusions: ["Tree surgery requiring specialist equipment", "Planning or tree preservation order applications", "Underground services not identified before work"],
    commonQuestions: ["What are the measurements of the area?", "Is there side or rear access for materials?", "Do you know where any underground services run?"],
    defaultAssumptions: ["Ground conditions are normal and free of buried obstructions", "Access for materials and waste is available"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "joiner-carpenter",
    name: "Joiner and carpenter",
    description: "Doors, kitchens, flooring and bespoke joinery.",
    icon: "ruler",
    sortOrder: 6,
    suggestedServices: [
      { name: "Carpenter labour", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 26000, internalCostMinor: 14000 },
      { name: "Hang internal door", category: "Doors", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 12000, internalCostMinor: 5000 },
      { name: "Fit skirting board", category: "Finishing", unit: "METRE", kind: "LABOUR", unitPriceMinor: 1800, internalCostMinor: 900 },
      { name: "Kitchen fitting", category: "Kitchens", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 180000, internalCostMinor: 95000 },
      { name: "Laminate flooring", category: "Flooring", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 2800, internalCostMinor: 1500 },
      { name: "Timber and fixings", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 5000, internalCostMinor: 3800 },
    ],
    defaultScope: "All joinery will be measured on site before manufacture or ordering. Work will be finished ready for decoration unless stated.",
    commonExclusions: ["Decoration and painting of new joinery", "Electrical and plumbing alterations", "Disposal of old units unless stated"],
    commonQuestions: ["Have units or materials already been ordered?", "Are the walls and floors level?", "Do you need old items removed?"],
    defaultAssumptions: ["Walls and floors are within normal tolerances", "Existing services do not need to be moved"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "roofer",
    name: "Roofer",
    description: "Roof repairs, replacements and flat roofs.",
    icon: "home",
    sortOrder: 7,
    suggestedServices: [
      { name: "Roofer labour", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 28000, internalCostMinor: 15000 },
      { name: "Roof inspection", category: "Inspection", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 3000 },
      { name: "Replace broken tiles", category: "Repairs", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 3500, internalCostMinor: 1500 },
      { name: "Re-roof (per square metre)", category: "Replacement", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 12000, internalCostMinor: 7000 },
      { name: "Flat roof replacement", category: "Flat roofs", unit: "SQUARE_METRE", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 5500 },
      { name: "Guttering replacement", category: "Rainwater", unit: "METRE", kind: "LABOUR", unitPriceMinor: 4500, internalCostMinor: 2200 },
      { name: "Scaffolding", category: "Site", unit: "FIXED", kind: "OTHER", unitPriceMinor: 85000, internalCostMinor: 70000 },
      { name: "Roofing materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 15000, internalCostMinor: 12000 },
    ],
    defaultScope: "Work will be carried out from safe access and in accordance with manufacturer guidance. Debris will be removed on completion.",
    commonExclusions: ["Timber repairs found once the roof covering is removed", "Chimney or lead work unless stated", "Internal decoration"],
    commonQuestions: ["Is there evidence of water ingress inside the property?", "When was the roof last inspected?", "Is scaffolding access possible on all sides?"],
    defaultAssumptions: ["Roof timbers are sound", "Weather allows continuous working"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "heating-engineer",
    name: "Heating engineer",
    description: "Boilers, heating systems and servicing.",
    icon: "flame",
    sortOrder: 8,
    suggestedServices: [
      { name: "Heating engineer labour", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 3000 },
      { name: "Boiler service", category: "Servicing", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 3500 },
      { name: "Boiler replacement (combi)", category: "Boilers", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 240000, internalCostMinor: 150000 },
      { name: "Power flush", category: "Servicing", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 45000, internalCostMinor: 18000 },
      { name: "Thermostatic radiator valve", category: "Controls", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 3000 },
      { name: "Smart thermostat installation", category: "Controls", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 22000, internalCostMinor: 14000 },
      { name: "Landlord gas safety certificate", category: "Certification", unit: "ITEM", kind: "OTHER", unitPriceMinor: 8500, internalCostMinor: 2500 },
      { name: "Parts and materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 5000, internalCostMinor: 3800 },
    ],
    defaultScope: "All gas work will be carried out by a Gas Safe registered engineer and commissioned on completion. Certificates will be provided where applicable.",
    commonExclusions: ["Repairs to existing pipework found to be undersized", "Building work to create flue routes", "Decoration"],
    commonQuestions: ["What make and model is the existing boiler?", "How many radiators and bathrooms are there?", "Where is the gas meter?"],
    defaultAssumptions: ["The existing system is compatible with the proposed equipment", "Gas supply and pressure are adequate"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "handyman",
    name: "Handyman",
    description: "Small jobs, repairs and property maintenance.",
    icon: "wrench",
    sortOrder: 9,
    suggestedServices: [
      { name: "Handyman labour", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 4500, internalCostMinor: 2000 },
      { name: "Half-day rate", category: "Labour", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 16000, internalCostMinor: 7000 },
      { name: "Full-day rate", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 28000, internalCostMinor: 12000 },
      { name: "Flat-pack assembly", category: "Assembly", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 2500 },
      { name: "TV wall mounting", category: "Installation", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 8500, internalCostMinor: 3000 },
      { name: "Materials and fixings", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 2500, internalCostMinor: 1800 },
    ],
    defaultScope: "Small works will be completed in a single visit where possible. Any additional items noticed on site will be quoted separately.",
    commonExclusions: ["Gas and notifiable electrical work", "Structural alterations", "Specialist materials"],
    commonQuestions: ["Is parking available near the property?", "Are all items to be assembled on site?", "Do you need materials supplied?"],
    defaultAssumptions: ["Work can be completed during normal working hours", "Access is available at the agreed time"],
    defaultTerms: "Payment is due on completion of the work unless agreed otherwise.",
  },
  {
    slug: "cleaning",
    name: "Cleaning business",
    description: "Domestic, end-of-tenancy and commercial cleaning.",
    icon: "sparkles",
    sortOrder: 10,
    suggestedServices: [
      { name: "Cleaner (per hour)", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 2200, internalCostMinor: 1400 },
      { name: "End-of-tenancy clean (1 bed)", category: "Packages", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 18000, internalCostMinor: 9000 },
      { name: "End-of-tenancy clean (3 bed)", category: "Packages", unit: "FIXED", kind: "LABOUR", unitPriceMinor: 32000, internalCostMinor: 16000 },
      { name: "Carpet cleaning", category: "Specialist", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 4500, internalCostMinor: 1800 },
      { name: "Oven clean", category: "Specialist", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 2500 },
      { name: "Cleaning products", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 1500, internalCostMinor: 900 },
    ],
    defaultScope: "All areas listed will be cleaned to a professional standard using our own equipment and products unless stated.",
    commonExclusions: ["Removal of bulky waste", "Cleaning of exterior windows above ground floor", "Mould remediation"],
    commonQuestions: ["How many bedrooms and bathrooms are there?", "Is the property furnished?", "Are there any areas that need special attention?"],
    defaultAssumptions: ["Utilities (water and electricity) are connected", "Access is arranged for the agreed time"],
    defaultTerms: "Payment is due on completion. Cancellations within 24 hours may incur a fee.",
  },
  {
    slug: "property-maintenance",
    name: "Property maintenance",
    description: "Reactive and planned maintenance for landlords and agents.",
    icon: "building",
    sortOrder: 11,
    suggestedServices: [
      { name: "Maintenance labour", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 4800, internalCostMinor: 2200 },
      { name: "Call-out visit", category: "Labour", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 7500, internalCostMinor: 2500 },
      { name: "Gutter clearing", category: "Exterior", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 9500, internalCostMinor: 3500 },
      { name: "Lock change", category: "Security", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 11000, internalCostMinor: 5000 },
      { name: "Silicone and seal renewal", category: "Bathrooms", unit: "ITEM", kind: "LABOUR", unitPriceMinor: 8500, internalCostMinor: 2500 },
      { name: "Materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 3000, internalCostMinor: 2200 },
    ],
    defaultScope: "Works will be carried out with minimum disruption to tenants and reported on completion with photographs where appropriate.",
    commonExclusions: ["Works requiring specialist certification unless stated", "Parts on long lead times", "Out-of-hours attendance unless stated"],
    commonQuestions: ["Is the property tenanted, and who should we arrange access with?", "Is there a key safe?", "Should the invoice go to the agent or the landlord?"],
    defaultAssumptions: ["Access can be arranged within normal working hours", "No hazardous materials are present"],
    defaultTerms: GENERIC_TERMS,
  },
  {
    slug: "general",
    name: "Other local service",
    description: "A general starting point for any local service business.",
    icon: "briefcase",
    sortOrder: 20,
    suggestedServices: [
      { name: "Labour (per hour)", category: "Labour", unit: "HOUR", kind: "LABOUR", unitPriceMinor: 4500, internalCostMinor: 2000 },
      { name: "Labour (per day)", category: "Labour", unit: "DAY", kind: "LABOUR", unitPriceMinor: 28000, internalCostMinor: 13000 },
      { name: "Call-out visit", category: "Labour", unit: "VISIT", kind: "LABOUR", unitPriceMinor: 6500, internalCostMinor: 2000 },
      { name: "Materials", category: "Materials", unit: "ITEM", kind: "MATERIAL", unitPriceMinor: 2500, internalCostMinor: 1800 },
    ],
    defaultScope: "The work described will be carried out to a professional standard and the area left clean and tidy on completion.",
    commonExclusions: ["Work not described in this quote", "Unforeseen conditions discovered once work starts"],
    commonQuestions: ["When would you like the work to start?", "Is there anything else we should know about access?"],
    defaultAssumptions: ["Access is available on the agreed dates"],
    defaultTerms: GENERIC_TERMS,
  },
];

export const TRADE_OPTIONS = TRADE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name }));

export function findTradeTemplate(slug: string | null | undefined): TradeTemplateSeed {
  return TRADE_TEMPLATES.find((t) => t.slug === slug) ?? TRADE_TEMPLATES[TRADE_TEMPLATES.length - 1]!;
}
