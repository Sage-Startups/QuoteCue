-- Business-rule constraints that Prisma cannot express in the schema.

-- Credit balances can never go negative.
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_aiCreditBalance_non_negative" CHECK ("aiCreditBalance" >= 0);
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_balanceAfter_non_negative" CHECK ("balanceAfter" >= 0);

-- Money and quantities must be sane.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_unitPrice_non_negative" CHECK ("unitPriceMinor" >= 0);
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_totals_non_negative" CHECK ("subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0 AND "discountMinor" >= 0);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_taxRate_range" CHECK ("taxRateBps" >= 0 AND "taxRateBps" <= 10000);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_validity_range" CHECK ("quoteValidityDays" >= 1 AND "quoteValidityDays" <= 365);
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_count_non_negative" CHECK ("count" >= 0);
ALTER TABLE "QuoteCounter" ADD CONSTRAINT "QuoteCounter_nextNumber_positive" CHECK ("nextNumber" >= 1);

-- Only one published prompt version per feature.
CREATE UNIQUE INDEX "AiPromptVersion_one_published_per_feature" ON "AiPromptVersion" ("feature") WHERE "isPublished" = true;

-- Only one default template per workspace.
CREATE UNIQUE INDEX "QuoteTemplate_one_default_per_workspace" ON "QuoteTemplate" ("workspaceId") WHERE "isDefault" = true AND "archivedAt" IS NULL;

-- Case-insensitive lookups for customer email and user email.
CREATE INDEX "Customer_workspace_email_lower_idx" ON "Customer" ("workspaceId", lower("email"));
