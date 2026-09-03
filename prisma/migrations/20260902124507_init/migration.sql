-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPPORT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GBP', 'EUR', 'CAD', 'AUD', 'NZD');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('NONE', 'VAT', 'GST', 'SALES_TAX', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('TAX_EXCLUSIVE', 'TAX_INCLUSIVE', 'NO_TAX');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('HOUR', 'DAY', 'ITEM', 'METRE', 'SQUARE_METRE', 'VISIT', 'FIXED');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('LABOUR', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('TAXABLE', 'EXEMPT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'READY', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "QuoteEventType" AS ENUM ('CREATED', 'UPDATED', 'AI_ANALYSIS', 'AI_GENERATION', 'READY', 'SENT', 'EMAIL_DELIVERED', 'EMAIL_FAILED', 'VIEWED', 'VIEW_REPEAT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REACTIVATED', 'REVISION_CREATED', 'DUPLICATED', 'ARCHIVED', 'RESTORED', 'PDF_GENERATED', 'LINK_COPIED', 'REMINDER_SENT', 'SUPPORT_ACCESS', 'NOTE');

-- CreateEnum
CREATE TYPE "QuoteActorType" AS ENUM ('USER', 'CUSTOMER', 'SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('LOGO', 'QUOTE_IMAGE', 'QUOTE_AUDIO', 'QUOTE_DOCUMENT', 'QUOTE_PDF', 'SITE_ASSET', 'EXPORT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('WELCOME', 'VERIFY_EMAIL', 'PASSWORD_RESET', 'MAGIC_LINK', 'ACCOUNT_EXISTS', 'TEAM_INVITE', 'QUOTE_SENT', 'QUOTE_VIEWED', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'QUOTE_EXPIRY_REMINDER', 'TRIAL_LIMIT_WARNING', 'SUBSCRIPTION_CONFIRMED', 'PAYMENT_FAILED', 'CONTACT_RECEIPT', 'TEST');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'PREVIEW', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('SUBSCRIPTION', 'CREDIT_PACK');

-- CreateEnum
CREATE TYPE "PlanKey" AS ENUM ('FREE', 'STARTER', 'PRO', 'CREDIT_PACK_5');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED', 'COMPLIMENTARY');

-- CreateEnum
CREATE TYPE "CreditLedgerType" AS ENUM ('TRIAL_GRANT', 'PACK_PURCHASE', 'ADMIN_GRANT', 'PROMOTIONAL', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('AI_GENERATION', 'EMAIL_SENT', 'PDF_GENERATED');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('ENQUIRY_ANALYSIS', 'IMAGE_ANALYSIS', 'TRANSCRIPTION', 'QUOTE_WORDING', 'SECTION_REGENERATE', 'PROMPT_TEST');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiErrorCategory" AS ENUM ('NONE', 'TIMEOUT', 'RATE_LIMIT', 'VALIDATION', 'PROVIDER', 'NETWORK', 'CONFIG', 'ENTITLEMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AcceptanceDecision" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'HANDLED', 'SPAM');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'en-GB',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "aiCreditBalance" INTEGER NOT NULL DEFAULT 0,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "tradeSlug" TEXT NOT NULL DEFAULT 'general',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "currency" "Currency" NOT NULL DEFAULT 'GBP',
    "taxMode" "TaxMode" NOT NULL DEFAULT 'VAT',
    "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
    "taxRateBps" INTEGER NOT NULL DEFAULT 2000,
    "taxNumber" TEXT,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'TAX_EXCLUSIVE',
    "labourRateMinor" INTEGER NOT NULL DEFAULT 4500,
    "labourRateUnit" "ServiceUnit" NOT NULL DEFAULT 'HOUR',
    "callOutFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Payment is due within 14 days of invoice. A deposit may be required before work begins.',
    "depositTerms" TEXT,
    "warrantyWording" TEXT,
    "quoteValidityDays" INTEGER NOT NULL DEFAULT 30,
    "quoteNumberPrefix" TEXT NOT NULL DEFAULT 'QC',
    "quoteFooter" TEXT,
    "logoObjectId" UUID,
    "brandColor" TEXT NOT NULL DEFAULT '#0f1f3d',
    "accentColor" TEXT NOT NULL DEFAULT '#d97706',
    "defaultTemplateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteCounter" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QuoteCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "contactName" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingCity" TEXT,
    "billingRegion" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "jobAddressLine1" TEXT,
    "jobAddressLine2" TEXT,
    "jobCity" TEXT,
    "jobRegion" TEXT,
    "jobPostalCode" TEXT,
    "jobCountry" TEXT,
    "internalNotes" TEXT,
    "preferredContactMethod" "ContactMethod" NOT NULL DEFAULT 'EMAIL',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTag" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTagAssignment" (
    "customerId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTagAssignment_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable
CREATE TABLE "ServiceCatalogueItem" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "description" TEXT,
    "customerDescription" TEXT,
    "unit" "ServiceUnit" NOT NULL DEFAULT 'ITEM',
    "kind" "ItemKind" NOT NULL DEFAULT 'LABOUR',
    "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "internalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'TAXABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tradeSlug" TEXT,
    "description" TEXT,
    "defaultTitle" TEXT,
    "scopeOfWork" TEXT,
    "includedWork" TEXT,
    "assumptions" TEXT,
    "exclusions" TEXT,
    "customerResponsibilities" TEXT,
    "paymentTerms" TEXT,
    "warrantyWording" TEXT,
    "estimatedSchedule" TEXT,
    "customerQuestions" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeTemplate" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "suggestedServices" JSONB NOT NULL,
    "defaultScope" TEXT,
    "commonExclusions" JSONB NOT NULL,
    "commonQuestions" JSONB NOT NULL,
    "defaultTerms" TEXT,
    "defaultAssumptions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "customerId" UUID,
    "templateId" UUID,
    "createdById" UUID,
    "number" TEXT NOT NULL,
    "reference" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "Currency" NOT NULL DEFAULT 'GBP',
    "title" TEXT NOT NULL DEFAULT 'New quote',
    "wizardStep" INTEGER NOT NULL DEFAULT 1,
    "jobAddressLine1" TEXT,
    "jobAddressLine2" TEXT,
    "jobCity" TEXT,
    "jobRegion" TEXT,
    "jobPostalCode" TEXT,
    "jobCountry" TEXT,
    "enquiryText" TEXT,
    "jobNotes" TEXT,
    "transcript" TEXT,
    "internalNotes" TEXT,
    "aiAnalysis" JSONB,
    "aiAnalysisAt" TIMESTAMP(3),
    "currentVersionId" UUID,
    "publicTokenHash" TEXT,
    "publicTokenExpiresAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "lastEmailedAt" TIMESTAMP(3),
    "pdfObjectId" UUID,
    "duplicatedFromId" UUID,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "jobSummary" TEXT,
    "scopeOfWork" TEXT,
    "includedWork" TEXT,
    "assumptions" TEXT,
    "exclusions" TEXT,
    "customerResponsibilities" TEXT,
    "customerQuestions" JSONB,
    "paymentTerms" TEXT,
    "estimatedSchedule" TEXT,
    "warrantyWording" TEXT,
    "validityWording" TEXT,
    "followUpEmail" TEXT,
    "depositTerms" TEXT,
    "customerNotes" TEXT,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'TAX_EXCLUSIVE',
    "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "callOutFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "callOutFeeLabel" TEXT NOT NULL DEFAULT 'Call-out fee',
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "internalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "catalogueItemId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "ItemKind" NOT NULL DEFAULT 'LABOUR',
    "description" TEXT NOT NULL,
    "customerDescription" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" "ServiceUnit" NOT NULL DEFAULT 'ITEM',
    "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'TAXABLE',
    "internalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "lineSubtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "lineDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "lineTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteMedia" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "storedObjectId" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "caption" TEXT,
    "transcript" TEXT,
    "aiDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "type" "QuoteEventType" NOT NULL,
    "actorType" "QuoteActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorUserId" UUID,
    "message" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAcceptance" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "decision" "AcceptanceDecision" NOT NULL,
    "signedName" TEXT,
    "reason" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "userId" UUID,
    "purpose" "UploadPurpose" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expectedBytes" INTEGER NOT NULL,
    "actualBytes" INTEGER,
    "quoteId" UUID,
    "storedObjectId" UUID,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredObject" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFilename" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "checksum" TEXT,
    "retainUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageUsageSnapshot" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "totalBytes" BIGINT NOT NULL,
    "objectCount" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageUsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" UUID NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyMarkdown" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "userId" UUID,
    "quoteId" UUID,
    "kind" "EmailKind" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "htmlPreview" TEXT,
    "textPreview" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "key" "PlanKey" NOT NULL,
    "kind" "PlanKind" NOT NULL DEFAULT 'SUBSCRIPTION',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "annualPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "oneTimePriceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "aiGenerationsPerPeriod" INTEGER NOT NULL DEFAULT 0,
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 1,
    "storageAllowanceMb" INTEGER NOT NULL DEFAULT 500,
    "stripeMonthlyPriceId" TEXT,
    "stripeAnnualPriceId" TEXT,
    "stripeOneTimePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "featureBullets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" JSONB,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "complimentaryUntil" TIMESTAMP(3),
    "complimentaryReason" TEXT,
    "lastPaymentFailureAt" TIMESTAMP(3),
    "lastPaymentFailureMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "number" TEXT,
    "status" TEXT NOT NULL,
    "amountDueMinor" INTEGER NOT NULL,
    "amountPaidMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "description" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID,
    "type" "CreditLedgerType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "reason" TEXT,
    "aiRunId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" UUID NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "apiVersion" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "payloadSummary" JSONB,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptVersion" (
    "id" UUID NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "model" TEXT,
    "notes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "userId" UUID,
    "quoteId" UUID,
    "feature" "AiFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersionId" UUID,
    "promptVersionNo" INTEGER,
    "status" "AiRunStatus" NOT NULL DEFAULT 'RUNNING',
    "errorCategory" "AiErrorCategory" NOT NULL DEFAULT 'NONE',
    "errorMessage" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "creditConsumed" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContent" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJobRun" (
    "id" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "host" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "BackgroundJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "userId" UUID,
    "workspaceId" UUID,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationError" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSubmission" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceDailyStat" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "quotesCreated" INTEGER NOT NULL DEFAULT 0,
    "quotesSent" INTEGER NOT NULL DEFAULT 0,
    "quotesViewed" INTEGER NOT NULL DEFAULT 0,
    "quotesAccepted" INTEGER NOT NULL DEFAULT 0,
    "quotesDeclined" INTEGER NOT NULL DEFAULT 0,
    "valueQuotedMinor" INTEGER NOT NULL DEFAULT 0,
    "valueAcceptedMinor" INTEGER NOT NULL DEFAULT 0,
    "aiGenerations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_platformRole_idx" ON "user"("platformRole");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

-- CreateIndex
CREATE INDEX "Workspace_isDemo_idx" ON "Workspace"("isDemo");

-- CreateIndex
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_tokenHash_key" ON "WorkspaceInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_email_idx" ON "WorkspaceInvite"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_workspaceId_key" ON "BusinessSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteCounter_workspaceId_year_key" ON "QuoteCounter"("workspaceId", "year");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_archivedAt_idx" ON "Customer"("workspaceId", "archivedAt");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_email_idx" ON "Customer"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_phone_idx" ON "Customer"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_contactName_idx" ON "Customer"("workspaceId", "contactName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTag_workspaceId_name_key" ON "CustomerTag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "CustomerTagAssignment_tagId_idx" ON "CustomerTagAssignment"("tagId");

-- CreateIndex
CREATE INDEX "ServiceCatalogueItem_workspaceId_isActive_idx" ON "ServiceCatalogueItem"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceCatalogueItem_workspaceId_category_idx" ON "ServiceCatalogueItem"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "ServiceCatalogueItem_workspaceId_name_idx" ON "ServiceCatalogueItem"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "QuoteTemplate_workspaceId_archivedAt_idx" ON "QuoteTemplate"("workspaceId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TradeTemplate_slug_key" ON "TradeTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_currentVersionId_key" ON "Quote"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicTokenHash_key" ON "Quote"("publicTokenHash");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_status_idx" ON "Quote"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_customerId_idx" ON "Quote"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_createdAt_idx" ON "Quote"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_sentAt_idx" ON "Quote"("workspaceId", "sentAt");

-- CreateIndex
CREATE INDEX "Quote_status_expiresAt_idx" ON "Quote"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_workspaceId_number_key" ON "Quote"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "QuoteVersion_workspaceId_idx" ON "QuoteVersion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_quoteId_versionNumber_key" ON "QuoteVersion"("quoteId", "versionNumber");

-- CreateIndex
CREATE INDEX "QuoteItem_versionId_sortOrder_idx" ON "QuoteItem"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteItem_workspaceId_idx" ON "QuoteItem"("workspaceId");

-- CreateIndex
CREATE INDEX "QuoteMedia_quoteId_idx" ON "QuoteMedia"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteMedia_workspaceId_idx" ON "QuoteMedia"("workspaceId");

-- CreateIndex
CREATE INDEX "QuoteEvent_quoteId_createdAt_idx" ON "QuoteEvent"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteEvent_workspaceId_type_createdAt_idx" ON "QuoteEvent"("workspaceId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteAcceptance_quoteId_idx" ON "QuoteAcceptance"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteAcceptance_workspaceId_decision_createdAt_idx" ON "QuoteAcceptance"("workspaceId", "decision", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_objectKey_key" ON "Upload"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_storedObjectId_key" ON "Upload"("storedObjectId");

-- CreateIndex
CREATE INDEX "Upload_status_expiresAt_idx" ON "Upload"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Upload_workspaceId_idx" ON "Upload"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_key_key" ON "StoredObject"("key");

-- CreateIndex
CREATE INDEX "StoredObject_workspaceId_purpose_idx" ON "StoredObject"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "StoredObject_deletedAt_idx" ON "StoredObject"("deletedAt");

-- CreateIndex
CREATE INDEX "StorageUsageSnapshot_workspaceId_recordedAt_idx" ON "StorageUsageSnapshot"("workspaceId", "recordedAt");

-- CreateIndex
CREATE INDEX "StorageUsageSnapshot_recordedAt_idx" ON "StorageUsageSnapshot"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_kind_key" ON "EmailTemplate"("kind");

-- CreateIndex
CREATE INDEX "EmailEvent_workspaceId_createdAt_idx" ON "EmailEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_kind_createdAt_idx" ON "EmailEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_status_createdAt_idx" ON "EmailEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntitlement_planId_key_key" ON "PlanEntitlement"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_stripeInvoiceId_key" ON "BillingInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "BillingInvoice_workspaceId_createdAt_idx" ON "BillingInvoice"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_idempotencyKey_key" ON "CreditLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_workspaceId_createdAt_idx" ON "CreditLedgerEntry"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_workspaceId_metric_periodStart_key" ON "UsageRecord"("workspaceId", "metric", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_type_createdAt_idx" ON "StripeWebhookEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_status_createdAt_idx" ON "StripeWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiPromptVersion_feature_isPublished_idx" ON "AiPromptVersion"("feature", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptVersion_feature_version_key" ON "AiPromptVersion"("feature", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AiRun_idempotencyKey_key" ON "AiRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiRun_workspaceId_startedAt_idx" ON "AiRun"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "AiRun_feature_status_startedAt_idx" ON "AiRun"("feature", "status", "startedAt");

-- CreateIndex
CREATE INDEX "AiRun_startedAt_idx" ON "AiRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingContent_key_key" ON "MarketingContent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SupportSession_adminUserId_endedAt_idx" ON "SupportSession"("adminUserId", "endedAt");

-- CreateIndex
CREATE INDEX "SupportSession_workspaceId_idx" ON "SupportSession"("workspaceId");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_jobName_startedAt_idx" ON "BackgroundJobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_runId_idx" ON "BackgroundJobRun"("runId");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_status_startedAt_idx" ON "BackgroundJobRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_name_createdAt_idx" ON "ApplicationEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_workspaceId_createdAt_idx" ON "ApplicationEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_createdAt_idx" ON "ApplicationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ApplicationError_createdAt_idx" ON "ApplicationError"("createdAt");

-- CreateIndex
CREATE INDEX "ContactSubmission_status_createdAt_idx" ON "ContactSubmission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDailyStat_workspaceId_day_key" ON "WorkspaceDailyStat"("workspaceId", "day");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_logoObjectId_fkey" FOREIGN KEY ("logoObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCounter" ADD CONSTRAINT "QuoteCounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTag" ADD CONSTRAINT "CustomerTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagAssignment" ADD CONSTRAINT "CustomerTagAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagAssignment" ADD CONSTRAINT "CustomerTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CustomerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalogueItem" ADD CONSTRAINT "ServiceCatalogueItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "QuoteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_pdfObjectId_fkey" FOREIGN KEY ("pdfObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "ServiceCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteMedia" ADD CONSTRAINT "QuoteMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteMedia" ADD CONSTRAINT "QuoteMedia_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteMedia" ADD CONSTRAINT "QuoteMedia_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAcceptance" ADD CONSTRAINT "QuoteAcceptance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAcceptance" ADD CONSTRAINT "QuoteAcceptance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAcceptance" ADD CONSTRAINT "QuoteAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredObject" ADD CONSTRAINT "StoredObject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageUsageSnapshot" ADD CONSTRAINT "StorageUsageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptVersion" ADD CONSTRAINT "AiPromptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiPromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDailyStat" ADD CONSTRAINT "WorkspaceDailyStat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
