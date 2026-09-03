"use client";

import { useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { useUploader } from "@/components/uploads/use-upload";

/** Uploads a public site asset (logo, favicon, social image) and stores the object id in a hidden input. */
export function SiteAssetUpload({ name, initialObjectId, label, accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon", hint }: { name: string; initialObjectId: string | null; label: string; accept?: string; hint?: string }) {
  const { uploads, upload } = useUploader({ purpose: "SITE_ASSET" });
  const [objectId, setObjectId] = useState<string>(initialObjectId ?? "");
  const current = uploads[uploads.length - 1];
  const preview = objectId ? `/api/files/${objectId}` : null;
  const inputId = `asset-${name.replace(/\./g, "-")}`;
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={objectId} />
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
            <Upload className="size-4" aria-hidden="true" />
            {preview ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            <input
              id={inputId}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const result = await upload(file);
                if (result) setObjectId(result.storedObjectId);
              }}
            />
          </label>
          {preview ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setObjectId("")}>
              <Trash2 /> Remove (use built-in)
            </Button>
          ) : null}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {current?.status === "uploading" ? <p className="text-xs text-muted-foreground">Uploading… {current.progress}%</p> : null}
      {current?.status === "processing" ? <p className="text-xs text-muted-foreground">Processing…</p> : null}
      {current?.status === "error" ? <Alert variant="destructive">{current.error}</Alert> : null}
    </div>
  );
}
