# File storage

All user files (job photographs, voice notes, documents, logos, generated quote PDFs and site assets) are stored as **private objects** in an S3-compatible bucket. Nothing is ever served from a public bucket URL: access is granted only through short-lived presigned URLs or authenticated proxy routes. The code lives in `src/lib/storage/*`, `src/lib/services/uploads.ts` and the route handlers under `src/app/api/uploads`, `src/app/api/files` and `src/app/api/storage/local`.

## Providers

`getStorage()` (`src/lib/storage/index.ts`) selects one implementation of the `StorageProvider` interface from `STORAGE_PROVIDER` and caches it for the process:

| `STORAGE_PROVIDER` | Class | Use |
| --- | --- | --- |
| `railway` (default for production) | `RailwayBucketStorage` (`railway.ts`) | Railway Storage Bucket through the AWS SDK v3 `S3Client` |
| `s3` | `RailwayBucketStorage` with `name = "s3"` | Any other S3-compatible service (AWS S3, Cloudflare R2, MinIO, ...) using the same variables |
| `local` (default) | `LocalFileStorage` (`local.ts`) | Development only: files under `LOCAL_STORAGE_PATH` (default `.local-storage`, git-ignored) |
| `memory` | `InMemoryStorage` (`memory.ts`) | Automated tests only; contents disappear with the process |

`src/lib/env.ts` refuses to start in production with `local` or `memory`, and refuses `railway`/`s3` unless all five bucket variables are present.

The interface (`types.ts`) is deliberately small: `putObject`, `getObject`, `headObject`, `deleteObject`, `createPresignedUpload`, `createPresignedDownload` and `healthCheck`.

### Railway bucket configuration

Railway exposes the bucket's credentials as service variables. Map them onto the application's names (this is the mapping in `.env.example`):

| Railway bucket variable | Application variable |
| --- | --- |
| `BUCKET` | `STORAGE_BUCKET` |
| `ENDPOINT` | `STORAGE_ENDPOINT` |
| `REGION` | `STORAGE_REGION` |
| `ACCESS_KEY_ID` | `STORAGE_ACCESS_KEY_ID` |
| `SECRET_ACCESS_KEY` | `STORAGE_SECRET_ACCESS_KEY` |

```dotenv
STORAGE_PROVIDER=railway
STORAGE_BUCKET=${{Bucket.BUCKET}}
STORAGE_ENDPOINT=${{Bucket.ENDPOINT}}
STORAGE_REGION=${{Bucket.REGION}}
STORAGE_ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}
STORAGE_SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}
STORAGE_FORCE_PATH_STYLE=true
```

(`Bucket` is whatever you named the bucket service in Railway.) The S3 client is created with `forcePathStyle` set from `STORAGE_FORCE_PATH_STYLE` (defaults to `true` when unset) and the endpoint/region/credentials above. `healthCheck()` sends `HeadBucket` and is reported by `/api/health/system`.

### Local development

`LocalFileStorage` mimics the presigned flow so the browser code is identical in every environment:

- Presigned upload: `PUT /api/storage/local/upload?key=...&exp=...&ct=...&sig=...`
- Presigned download: `GET /api/storage/local/object?key=...&exp=...&sig=...[&filename=...]`

The `sig` is an HMAC-SHA256 over the action, key, expiry and content type, keyed with `BETTER_AUTH_SECRET` (`signed-url.ts`), compared with `timingSafeEqual`. Both routes return 404 unless the active provider is `local` or `memory`, and 403 for an invalid, tampered or expired signature. Files are written next to a `<file>.meta.json` holding the content type. Object keys are checked with `isSafeObjectKey` and resolved inside the storage root so a key can never escape it. Because the signed URL embeds `APP_URL`, uploads fail in development if the browser origin differs from `APP_URL`.

## Object keys

`buildObjectKey(purpose, scopeId, mime)` (`keys.ts`) produces keys of the form

```
<prefix>/<scope>/<base36 timestamp>-<24 hex random>.<ext>
```

| `UploadPurpose` | Prefix | Scope |
| --- | --- | --- |
| `LOGO` | `logos` | workspace id (or user id during onboarding) |
| `QUOTE_IMAGE` | `quotes/images` | workspace id |
| `QUOTE_AUDIO` | `quotes/audio` | workspace id |
| `QUOTE_DOCUMENT` | `quotes/documents` | workspace id |
| `QUOTE_PDF` | `quotes/pdf` | workspace id |
| `SITE_ASSET` | `site` | `system` or the uploader's id |
| `EXPORT` | `exports` | workspace id |

The extension is derived from the MIME type (`extensionForMime`, falling back to `bin`); the user's file name is stored in `StoredObject.originalFilename` for display only and never becomes part of the key. Keys are therefore unguessable and free of path traversal or collisions.

## Upload flow (browser → bucket → app)

The application never streams file bytes through the web service. The sequence is:

1. **Presign** — `POST /api/uploads/presign` with `{ purpose, filename, mimeType, sizeBytes, quoteId? }`. The route requires a session, applies the `presign` rate limit (60 per 10 minutes per user), and checks authorisation per purpose: `SITE_ASSET` requires a super admin; `LOGO` may be uploaded without a workspace during onboarding (`workspaceId` is `null` until the workspace claims it); every other purpose requires a workspace and rejects read-only support sessions. `createPresignedUpload` then validates the request against the **upload policy** (below), checks that the extension matches the MIME type, verifies that `quoteId` belongs to the workspace, creates a `PENDING` row in `Upload` and returns `{ uploadId, url, method: "PUT", headers, expiresAt }`. Presigned upload URLs are valid for **5 minutes** (`PRESIGN_TTL_SECONDS = 300`).
2. **PUT** — the browser uploads the file directly to the returned URL with the returned `Content-Type` header. The CSP `connect-src` includes `https:` for this reason.
3. **Finalise** — `POST /api/uploads/finalize` with `{ uploadId, quoteId?, attachAs? }`. `finalizeUpload` re-loads the pending row for the same user/workspace, `HEAD`s the object, and fails the upload (deleting the object) if it is missing or larger than the policy maximum or more than 5 % + 1 KB above the declared size. Raster images are then re-encoded (below), a `StoredObject` row is created, the upload is marked `COMPLETED`, and when `quoteId` + `attachAs` are given the object is attached to the quote as `QuoteMedia`. The response includes a 5-minute presigned `previewUrl` for images. Finalising an already completed upload returns the existing object (idempotent).

Incomplete uploads are cleaned up by the `clean-expired-uploads` job after `app.uploadRetentionDays` (default 1 day) and their rows purged 30 days later (see [RAILWAY_CRON.md](RAILWAY_CRON.md)).

### Upload policies

`uploadPolicyFor(purpose)` reads the limits from site settings (`src/lib/config/site-settings.ts`), so they can be changed in the database without a deploy:

| Purpose | Maximum size | Accepted types |
| --- | --- | --- |
| `LOGO` | `app.maxLogoMb` (default 2 MB) | PNG, JPEG, WebP, SVG |
| `QUOTE_IMAGE` | `app.maxImageMb` (15 MB) | `app.allowedImageTypes` (JPEG, PNG, WebP, HEIC, HEIF) |
| `QUOTE_AUDIO` | `app.maxAudioMb` (25 MB) | `app.allowedAudioTypes` (MP3, WAV, M4A/MP4, WebM, Ogg) |
| `QUOTE_DOCUMENT` | `app.maxDocumentMb` (10 MB) | `app.allowedDocumentTypes` (PDF, plain text) |
| `SITE_ASSET` | 5 MB | PNG, JPEG, WebP, SVG, ICO |
| other (`QUOTE_PDF`, `EXPORT`) | 20 MB | PDF, CSV, JSON |

`app.maxImagesPerQuote` (default 10) limits photographs per quote. Only `text/plain` documents are passed to the AI (up to three, 6,000 characters each); PDFs are stored for reference.

### Image processing

Every raster image (anything `image/*` except SVG) is re-encoded with `sharp` in `processImage` before it is accepted:

- auto-rotated from the EXIF orientation, then resized to fit within 2000 px (logos 800 px, site assets 1600 px) without enlarging;
- logos and site assets that are PNG or have transparency stay PNG (compression level 9); everything else becomes JPEG (quality 82, mozjpeg);
- **all metadata (EXIF, GPS, camera details) is stripped** because `withMetadata()` is never called;
- width, height, final size and a SHA-256 checksum are recorded on `StoredObject`.

If decoding fails the object is deleted and the user is asked for a JPEG, PNG or WebP. HEIC/HEIF are accepted by the default policy but rely on the HEIF support compiled into the bundled `sharp`/libvips; if that is absent the upload fails cleanly with that message rather than storing an unprocessed file.

## Reading files

| Route / helper | Who may read | Notes |
| --- | --- | --- |
| `GET /api/files/[id]` | `SITE_ASSET`: anyone (cached 1 h). Workspace objects: members of that workspace (active support sessions count as members), plus super admins for `LOGO`. Unclaimed objects (`workspaceId` null, e.g. an onboarding logo): only the uploader or a super admin | Streams the object through the app with `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` and `private, max-age=60` |
| `signedDownloadUrl(storedObjectId)` | Caller must have already authorised the request | Presigned GET valid for **5 minutes** (`DOWNLOAD_TTL_SECONDS = 300`) with `response-content-disposition` and content type; used for image previews in the wizard and quote pages |
| `GET /app/quotes/[id]/pdf` | Workspace members with the `PDF_DOWNLOAD` entitlement | Reuses the stored `QUOTE_PDF` object unless `?fresh=1`; `?download=1` forces attachment |
| `GET /q/[token]/pdf` | Anyone holding a valid customer link (rate limited `publicQuote`, 60 per 5 minutes per IP) | Renders the PDF from the current document on request; `X-Robots-Tag: noindex` |

`next.config.ts` sets `images.remotePatterns: []` so the Next.js image optimiser never fetches user files from a bucket.

## Generated objects and deletion

- `storeGeneratedObject` writes server-generated files (quote PDFs via `generateQuotePdf`) straight to the bucket and records a `StoredObject`.
- `deleteStoredObject` deletes the bucket object and **soft-deletes** the row (`deletedAt`); the `process-retention` job hard-deletes rows seven days later, removes media of quotes archived longer than `app.dataRetentionDays` (default 730), and finishes workspaces in `PENDING_DELETION` after 30 days.
- `deleteWorkspaceCompletely` (account deletion, admin deletion, retention) deletes every object of the workspace from the bucket before deleting the workspace row; database rows cascade.
- `record-storage-usage` snapshots bytes and object counts per workspace and platform-wide into `StorageUsageSnapshot` (kept 400 days).

## Backups

The bucket is **not** part of a PostgreSQL dump. Back it up with any S3-compatible CLI pointed at `STORAGE_ENDPOINT` (for example `aws s3 sync s3://<bucket> ./backup --endpoint-url <endpoint>` or `rclone sync`), see [HANDOVER.md](HANDOVER.md). Restoring a database without the matching objects leaves `StoredObject` rows whose files are missing; the proxy route returns 404 for those and PDFs are regenerated on demand.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `STORAGE_PROVIDER=railway requires: ...` at start-up | One of the five bucket variables is not mapped |
| Presign succeeds but the browser PUT fails with CORS or 403 | Endpoint or credentials wrong, or the presigned URL expired (5 minutes) |
| "The file did not reach storage" on finalise | The PUT never completed; retry the upload |
| "The uploaded file was larger than expected" | Declared `sizeBytes` did not match the object (tolerance 5 % + 1 KB) |
| Uploads work locally but previews 404 | `APP_URL` differs from the origin the browser is using; signed local URLs embed `APP_URL` |
| System health shows storage degraded | `HeadBucket` failed: check endpoint, region and that the key has access to the bucket |
