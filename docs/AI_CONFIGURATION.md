# AI configuration

The AI layer (`src/lib/ai/*`) turns enquiry text, notes, transcripts, documents and photographs into structured proposals and customer-facing wording. It is built on the OpenAI Responses API with Zod-validated structured outputs and is designed so that a bad model response can never reach the database unvalidated, invent a price, or cost the customer a credit.

## Providers

`getAiProvider()` (`index.ts`) returns `OpenAiProvider` when `OPENAI_API_KEY` is set and `MockAiProvider` otherwise. `src/lib/env.ts` refuses to start production with the mock provider.

| Provider | File | Behaviour |
| --- | --- | --- |
| `OpenAiProvider` | `openai-provider.ts` | Official `openai` SDK (`timeout` 90 s, `maxRetries: 0`; the runner handles retries). `responses.parse` with `zodTextFormat(schema, name)` and `store: false`; images are passed as `input_image` parts (detail `low` by default); audio uses `audio.transcriptions.create` (`response_format: "json"`, 120 s timeout). Errors are translated into `AiProviderError` categories: `TIMEOUT`, `RATE_LIMIT`, `NETWORK` and 5xx `PROVIDER` errors are retryable; `CONFIG` (bad key) and 4xx `VALIDATION` are not |
| `MockAiProvider` | `mock-provider.ts`, `mock-fixtures.ts` | Deterministic, keyword-driven fixtures that satisfy the same schemas and follow the same safety rules (no prices, caveats on photographs). Adds ~150 ms of latency so loading states are visible; reports model `mock-quotecue-v1`. `healthCheck` deliberately returns `ok: false` so the mock is never mistaken for a working configuration |

The interactive `/demo` pages call `buildMockFixture` directly and never use a paid provider, even when a real key is configured.

## Environment and site settings

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.4-mini            # default
OPENAI_VISION_MODEL=gpt-5.4-mini          # default; used whenever images are attached
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe   # default
```

`resolveModels()` (`runner.ts`) lets site settings override the environment without a restart (changes are cached for 15 seconds):

| Site setting | Default | Purpose |
| --- | --- | --- |
| `ai.enabled` | `true` | Master switch. When off every AI call (except `PROMPT_TEST`) fails with "AI features are currently disabled by the administrator" |
| `ai.textModel` | `""` (use `OPENAI_TEXT_MODEL`) | Model for text-only features |
| `ai.visionModel` | `""` (use `OPENAI_VISION_MODEL`) | Model when photographs are attached |
| `ai.transcribeModel` | `""` (use `OPENAI_TRANSCRIBE_MODEL`) | Transcription model |
| `ai.inputCostCentsPerMillionTokens` | `25` | Cost assumption for estimates |
| `ai.outputCostCentsPerMillionTokens` | `200` | Cost assumption for estimates |
| `ai.transcriptionCostCentsPerMinute` | `0.3` | Cost assumption for estimates |

A prompt version may also pin a `model`, which takes precedence over both.

## Features, schemas and prompts

Each `AiFeature` has a Zod schema in `schemas.ts` and a default prompt in `prompts.ts`:

| Feature | Schema | Consumes a generation | Used by |
| --- | --- | --- | --- |
| `ENQUIRY_ANALYSIS` | `enquiryAnalysisSchema`: job summary, detected trade, suggested work items (description, source, confidence, `requiresConfirmation`, kind, matched catalogue id/name/confidence, quantity with `quantitySource` explicit/estimated/unknown, unit), uncertainties, missing information, customer questions, assumptions, photo observations with caveats, safety notes, inspection recommendation, readiness (`ready`, `needs_confirmation`, `needs_inspection`) | Yes | Wizard step 3 (`analyseQuoteEnquiry`) |
| `QUOTE_WORDING` | `quoteWordingSchema`: `title`, `jobSummary`, `scopeOfWork`, `includedWork`, `assumptions`, `exclusions`, `customerResponsibilities`, `paymentTerms`, `estimatedSchedule`, `warrantyWording`, `validityWording`, `followUpEmail` (the twelve editable sections in `WORDING_SECTION_KEYS`) plus `customerQuestions` | Yes | Wizard step 5 (`generateQuoteWording`) |
| `SECTION_REGENERATE` | `sectionRegenerateSchema` (`content`) | No | "Regenerate" on one section (`regenerateSection`) |
| `TRANSCRIPTION` | n/a (audio) | No | Voice notes (`transcribeQuoteAudio`) |
| `IMAGE_ANALYSIS` | `imageAnalysisSchema` | No | Defined and seeded; photographs are currently analysed inside `ENQUIRY_ANALYSIS`, so no caller uses this feature on its own yet |
| `PROMPT_TEST` | `promptTestSchema` | No | The prompt tester on `/super-admin/prompts/[feature]` (`testPromptAction`), which runs a selected prompt version or the built-in default against sample input and returns free-text output with token counts and estimated cost; no credits are consumed; exempt from `ai.enabled` |

Every prompt shares the `SAFETY_RULES` block: never claim a photograph proves hidden conditions, compliance or measurements; never invent prices, rates or costs; only report explicitly stated quantities (otherwise mark as estimated and requiring confirmation); recommend an on-site inspection for hidden services, structure, gas, roofing, damp or drainage; only use catalogue ids from the supplied list; plain British English; no hidden reasoning.

Prompts use `{{variable}}` placeholders substituted by `substituteVariables` (shared with the email renderer). `ENQUIRY_ANALYSIS` receives `businessName`, `trade`, `currency`, `enquiryText`, `jobNotes`, `transcript`, `documents`, `photoCount` and the `catalogue` as `id | name | category | unit` lines; `QUOTE_WORDING` receives the customer, job summary, confirmed line items (`description | quantity | unit | kind`), totals summary, default payment terms and warranty, validity, assumptions, exclusions, open questions and template guidance. Prices are never sent for the model to reason about and never come back from it: pricing is done in `src/lib/quotes/pricing.ts`.

### Prompt versions

`pnpm db:seed` creates `AiPromptVersion` version 1 for each feature that has a prompt (not `TRANSCRIPTION`), published, and only when no version exists, so edited prompts survive re-seeding. `resolvePrompt(feature)` uses the single published version (`isPublished = true`) and falls back to `DEFAULT_PROMPTS` when none is published. Each version stores `systemPrompt`, `userTemplate`, optional `model`, `notes`, `createdById` and `publishedAt`; `(feature, version)` is unique. `AiRun` rows record the version id and number used, so output quality can be compared across versions.

To publish a new version until the console page exists:

```sql
INSERT INTO "AiPromptVersion" (id, feature, version, "systemPrompt", "userTemplate", notes, "isPublished", "publishedAt", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'QUOTE_WORDING', 2, '...', '...', 'Tighter exclusions', false, NULL, NOW(), NOW());
-- then swap the published flag inside one transaction
UPDATE "AiPromptVersion" SET "isPublished" = false WHERE feature = 'QUOTE_WORDING';
UPDATE "AiPromptVersion" SET "isPublished" = true, "publishedAt" = NOW() WHERE feature = 'QUOTE_WORDING' AND version = 2;
```

Keep every variable the feature supplies available in the template; unknown variables render as empty strings.

## The runner

`runStructuredAi(input)` (`runner.ts`) is the only path to the provider for structured features:

1. Check `ai.enabled`; resolve the prompt (or an explicit `promptOverride`) and the model (`prompt.model`, else vision model if images are attached, else text model).
2. Create an `AiRun` row with status `RUNNING`, provider, model, prompt version, optional idempotency key and image count.
3. Call the provider. On a retryable `AiProviderError` wait 800 ms and try once more (`RETRYABLE_ATTEMPTS = 2`); other errors fail immediately.
4. Re-validate the parsed output with the Zod schema. If it fails, make **one repair attempt**: the model is asked to fix the exact issues, with the previous response and the validation problems appended. A second failure marks the run `FAILED` with category `VALIDATION`.
5. Record `SUCCEEDED` with input/output tokens (summed over attempts and repair), `estimatedCostMicros`, duration and the model actually used, and return the validated data.

Failures record the error category (`TIMEOUT`, `RATE_LIMIT`, `VALIDATION`, `PROVIDER`, `NETWORK`, `CONFIG`, `UNKNOWN`), the message, tokens used so far and an `ApplicationError` (`ai.run`). The user-facing `AiRunError` always says that no credit has been used, which is true because credit consumption happens after the runner returns.

`runTranscription` follows the same pattern for audio (records `audioSeconds`, estimated from the response or the file size when the provider does not report duration).

### Cost estimates

`estimateCostMicros` converts tokens and audio seconds into micro-dollars using the three cost settings above. The figures are estimates for monitoring and the super-admin overview, not billing data; keep the settings in line with the model prices you actually pay. Query the last 30 days with the SQL in [DATABASE.md](DATABASE.md).

## How the wizard uses AI

`src/lib/services/quote-ai.ts`:

- **Transcription** (`transcribeQuoteAudio`): requires the `voice_recording` feature flag, rate limit `aiGeneration` (20 per 10 minutes per workspace), reads the audio object from storage, appends the transcript to the quote and the media item, adds an `AI_ANALYSIS` timeline event. No credit.
- **Analysis** (`analyseQuoteEnquiry`): rate limit, `assertCanGenerate`, requires at least one input. Up to **8 photographs** are sent as data URLs when `photo_analysis` is enabled, plus up to **3 plain-text documents** (6,000 characters each). The active catalogue is supplied for matching; any `matchedCatalogueItemId` not belonging to the workspace is nulled out after the run. Only then is a generation consumed (`consumeGeneration`, idempotency key `credit:<run id>`); the analysis, `aiAnalysisAt`, the wizard step and a timeline event are saved in one transaction, and the consumption is refunded if that transaction fails. Finally an `ai_analysis_completed` event is tracked and, on the trial plan, a `TRIAL_LIMIT_WARNING` email may be sent (once per seven days).
- **Wording** (`generateQuoteWording`): same guards; writes every section to the current `QuoteVersion` and consumes one generation.
- **Section regeneration** (`regenerateSection`): rate limited, free; replaces one section using the user's instruction.

Suggested work items become line items through `applySuggestionsAction`; the user prices them from the catalogue and the deterministic pricing engine computes totals.

## Monitoring

- `AiRun` holds every call with tokens, cost, duration, status and error category; the super-admin overview aggregates runs, successes, failures and cost per period (excluding `PROMPT_TEST`, optionally excluding the demo workspace).
- `GET /api/health/system` reports `openai.ok` by listing models (10 s timeout) and shows `providers.ai` (`openai` or `mock`).
- Quote timelines show "AI analysis completed (mock provider)" whenever the mock produced the result, so demo data is never mistaken for real output.

## Replacing the API key or model

Set the new `OPENAI_API_KEY` in Railway and redeploy (the SDK client is created once per process). To try a different model without a redeploy, set `ai.textModel` / `ai.visionModel` / `ai.transcribeModel` in `SiteSetting`; set them back to `""` to return to the environment defaults. Structured outputs require a model that supports the Responses API JSON schema format.
