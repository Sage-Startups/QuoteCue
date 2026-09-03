/** Sample values used for template previews and test emails. Pure; safe for client and server. */
export function sampleVariables(variables: string[], base: { productName: string; supportEmail: string; appUrl: string }): Record<string, string> {
  const out: Record<string, string> = { productName: base.productName, supportEmail: base.supportEmail, appUrl: base.appUrl };
  const specific: Record<string, string> = {
    name: "Alex Example",
    customerName: "Dave Customer",
    inviterName: "Sam Owner",
    signedName: "Dave Customer",
    businessName: "Example Electrical Ltd",
    workspaceName: "Example Electrical",
    planName: "Pro",
    role: "member",
    quoteNumber: "QC-2026-0042",
    quoteTitle: "Living room sockets and hallway lighting",
    total: "£1,240.00",
    amount: "$39.00",
    expiryDate: "30 September 2026",
    remaining: "1",
    reason: "Decided to postpone the work until spring.",
    message: "Thanks for getting in touch. Please find your quote below.",
    email: "alex@example.com",
  };
  for (const v of variables) {
    if (v in out) continue;
    if (v in specific) out[v] = specific[v]!;
    else if (/url$/i.test(v)) out[v] = `${base.appUrl}/${v.replace(/Url$/, "").toLowerCase()}-example`;
    else out[v] = `[${v}]`;
  }
  return out;
}
