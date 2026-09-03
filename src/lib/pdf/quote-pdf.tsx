import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { QuoteDocumentData } from "@/lib/services/quote-document";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { UNIT_SHORT } from "@/lib/quotes/units";
import type { ServiceUnit } from "@/generated/prisma/enums";
import { splitLines } from "@/lib/utils/strings";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 60, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: "#1f2937", lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  logo: { maxHeight: 48, maxWidth: 160, objectFit: "contain" },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  small: { fontSize: 8.5 },
  quoteTitleBlock: { alignItems: "flex-end" },
  quoteLabel: { fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22, gap: 16 },
  metaCol: { flex: 1 },
  metaHeading: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, color: "#6b7280", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 5 },
  paragraph: { marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10 },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#eef0f3" },
  colDesc: { flex: 5 },
  colQty: { flex: 1.2, textAlign: "right" },
  colUnit: { flex: 1.6, textAlign: "right" },
  colTotal: { flex: 1.6, textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1.5, borderTopColor: "#111827", fontFamily: "Helvetica-Bold", fontSize: 12 },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#6b7280", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  acceptanceBox: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", borderRadius: 4 },
  declinedBox: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 4 },
  groupHeading: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6, paddingVertical: 5, paddingHorizontal: 6, backgroundColor: "#fafafa" },
  kindTag: { fontSize: 8, color: "#6b7280" },
});

function Section({ title, content }: { title: string; content: string | null }) {
  if (!content || !content.trim()) return null;
  const lines = content.split(/\r?\n/);
  const isList = lines.filter((l) => l.trim()).every((l) => /^\s*[-*•]\s+/.test(l));
  return (
    <View wrap>
      <Text style={styles.h2}>{title}</Text>
      {isList ? (
        splitLines(content).map((line, i) => (
          <View key={i} style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={{ flex: 1 }}>{line}</Text>
          </View>
        ))
      ) : (
        lines
          .filter((l) => l.trim())
          .map((line, i) => (
            <Text key={i} style={styles.paragraph}>
              {line.replace(/^[-*•]\s*/, "")}
            </Text>
          ))
      )}
    </View>
  );
}

export function QuotePdfDocument({ data }: { data: QuoteDocumentData }) {
  const currency = data.quote.currency;
  const money = (minor: number) => formatMoney(minor, currency);
  const labour = data.items.filter((i) => i.kind === "LABOUR");
  const materials = data.items.filter((i) => i.kind === "MATERIAL");
  const other = data.items.filter((i) => i.kind === "OTHER");
  const groups = [
    { label: "Labour", items: labour },
    { label: "Materials", items: materials },
    { label: "Other", items: other },
  ].filter((g) => g.items.length > 0);
  const showGroups = groups.length > 1;
  const taxInclusive = data.totals.pricingMode === "TAX_INCLUSIVE";

  return (
    <Document title={`Quote ${data.quote.number}`} author={data.business.name} subject={data.quote.title} creator="QuoteCue AI">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed={false}>
          <View style={{ maxWidth: 300 }}>
            {data.business.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={data.business.logoDataUrl} style={styles.logo} />
            ) : <Text style={[styles.businessName, { color: data.business.brandColor }]}>{data.business.name}</Text>}
            {data.business.logoDataUrl ? <Text style={[styles.businessName, { marginTop: 6 }]}>{data.business.name}</Text> : null}
            {data.business.addressLines.map((l, i) => (
              <Text key={i} style={styles.muted}>
                {l}
              </Text>
            ))}
            {data.business.phone ? <Text style={styles.muted}>{data.business.phone}</Text> : null}
            {data.business.email ? <Text style={styles.muted}>{data.business.email}</Text> : null}
            {data.business.website ? <Text style={styles.muted}>{data.business.website}</Text> : null}
            {data.business.taxNumber ? <Text style={[styles.muted, styles.small]}>{data.totals.taxLabel} no. {data.business.taxNumber}</Text> : null}
          </View>
          <View style={styles.quoteTitleBlock}>
            <Text style={[styles.quoteLabel, { color: data.business.brandColor }]}>QUOTE</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{data.quote.number}</Text>
            {data.quote.versionNumber > 1 ? <Text style={styles.muted}>Revision {data.quote.versionNumber}</Text> : null}
            {data.quote.reference ? <Text style={styles.muted}>Ref: {data.quote.reference}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaHeading}>Prepared for</Text>
            {data.customer ? (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.customer.companyName ?? data.customer.contactName}</Text>
                {data.customer.companyName ? <Text>{data.customer.contactName}</Text> : null}
                {data.customer.billingAddress ? <Text style={styles.muted}>{data.customer.billingAddress}</Text> : null}
                {data.customer.email ? <Text style={styles.muted}>{data.customer.email}</Text> : null}
                {data.customer.phone ? <Text style={styles.muted}>{data.customer.phone}</Text> : null}
              </>
            ) : (
              <Text style={styles.muted}>Customer to be confirmed</Text>
            )}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaHeading}>Job address</Text>
            <Text>{data.jobAddress || "As above"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaHeading}>Dates</Text>
            <Text>Issued: {formatDate(data.quote.issuedAt ?? data.quote.createdAt)}</Text>
            <Text>Valid until: {formatDate(data.quote.expiresAt)}</Text>
          </View>
        </View>

        <Text style={styles.h1}>{data.quote.title}</Text>
        {data.sections.jobSummary ? <Text style={styles.paragraph}>{data.sections.jobSummary}</Text> : null}

        <Section title="Scope of work" content={data.sections.scopeOfWork} />

        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.colDesc, { fontFamily: "Helvetica-Bold" }]}>Description</Text>
            <Text style={[styles.colQty, { fontFamily: "Helvetica-Bold" }]}>Qty</Text>
            <Text style={[styles.colUnit, { fontFamily: "Helvetica-Bold" }]}>Unit price</Text>
            <Text style={[styles.colTotal, { fontFamily: "Helvetica-Bold" }]}>Total</Text>
          </View>
          {groups.map((group) => (
            <View key={group.label}>
              {showGroups ? <Text style={styles.groupHeading}>{group.label}</Text> : null}
              {group.items.map((item) => (
                <View key={item.id} style={styles.row} wrap={false}>
                  <View style={styles.colDesc}>
                    <Text>
                      {item.description}
                      {item.isOptional ? "  (optional)" : ""}
                    </Text>
                    {item.customerDescription ? <Text style={[styles.muted, styles.small]}>{item.customerDescription}</Text> : null}
                    {item.lineDiscountMinor > 0 ? <Text style={[styles.muted, styles.small]}>Includes discount of {money(item.lineDiscountMinor)}</Text> : null}
                  </View>
                  <Text style={styles.colQty}>
                    {item.quantity} {UNIT_SHORT[item.unit as ServiceUnit] ?? ""}
                  </Text>
                  <Text style={styles.colUnit}>{money(item.unitPriceMinor)}</Text>
                  <Text style={styles.colTotal}>{item.isOptional ? `(${money(item.lineTotalMinor)})` : money(item.lineTotalMinor)}</Text>
                </View>
              ))}
            </View>
          ))}
          {data.totals.callOutFeeMinor > 0 ? (
            <View style={styles.row} wrap={false}>
              <Text style={styles.colDesc}>{data.totals.callOutFeeLabel}</Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colUnit}>{money(data.totals.callOutFeeMinor)}</Text>
              <Text style={styles.colTotal}>{money(data.totals.callOutFeeMinor)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text>Subtotal{taxInclusive ? ` (incl. ${data.totals.taxLabel})` : ""}</Text>
            <Text>{money(data.totals.subtotalMinor)}</Text>
          </View>
          {data.totals.discountMinor > 0 ? (
            <View style={styles.totalRow}>
              <Text>{data.totals.discountLabel ?? "Discount"}</Text>
              <Text>-{money(data.totals.discountMinor)}</Text>
            </View>
          ) : null}
          {data.totals.pricingMode !== "NO_TAX" && data.totals.taxRateBps > 0 ? (
            <View style={styles.totalRow}>
              <Text>
                {taxInclusive ? `Of which ${data.totals.taxLabel}` : data.totals.taxLabel} ({(data.totals.taxRateBps / 100).toFixed(data.totals.taxRateBps % 100 === 0 ? 0 : 1)}%)
              </Text>
              <Text>{money(data.totals.taxMinor)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{money(data.totals.totalMinor)}</Text>
          </View>
          {data.totals.pricingMode === "NO_TAX" ? <Text style={[styles.muted, styles.small, { textAlign: "right" }]}>No tax applied to this quote.</Text> : null}
        </View>

        <Section title="What is included" content={data.sections.includedWork} />
        <Section title="Assumptions" content={data.sections.assumptions} />
        <Section title="Exclusions" content={data.sections.exclusions} />
        <Section title="Customer responsibilities" content={data.sections.customerResponsibilities} />
        <Section title="Estimated schedule" content={data.sections.estimatedSchedule} />
        <Section title="Payment terms" content={data.sections.paymentTerms} />
        <Section title="Deposit" content={data.sections.depositTerms} />
        <Section title="Warranty" content={data.sections.warrantyWording} />
        <Section title="Quote validity" content={data.sections.validityWording} />
        <Section title="Notes" content={data.sections.customerNotes} />

        {data.acceptance ? (
          <View style={data.acceptance.decision === "ACCEPTED" ? styles.acceptanceBox : styles.declinedBox} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.acceptance.decision === "ACCEPTED" ? "Quote accepted" : "Quote declined"}</Text>
            {data.acceptance.signedName ? <Text>Signed by: {data.acceptance.signedName}</Text> : null}
            <Text>Date: {formatDate(data.acceptance.at, "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
            {data.acceptance.reason ? <Text>Reason: {data.acceptance.reason}</Text> : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {data.business.footer ?? `${data.business.name} — Quote ${data.quote.number}`}
            {data.showQuoteCueBranding ? "  ·  Created with QuoteCue AI" : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(data: QuoteDocumentData): Promise<Buffer> {
  const buffer = await renderToBuffer(<QuotePdfDocument data={data} />);
  return Buffer.from(buffer);
}
