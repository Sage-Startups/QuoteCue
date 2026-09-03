"use client";

import { useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { useUploader } from "./use-upload";

export function LogoUpload({ name = "logoObjectId", initialObjectId, initialUrl, maxMb = 2 }: { name?: string; initialObjectId?: string | null; initialUrl?: string | null; maxMb?: number }) {
  const { uploads, upload } = useUploader({ purpose: "LOGO" });
  const [objectId, setObjectId] = useState<string>(initialObjectId ?? "");
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const current = uploads[uploads.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={objectId} />
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Business logo preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
            <Upload className="size-4" aria-hidden="true" />
            {preview ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const result = await upload(file);
                if (result) {
                  setObjectId(result.storedObjectId);
                  setPreview(result.previewUrl ?? `/api/files/${result.storedObjectId}`);
                }
              }}
            />
          </label>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setObjectId("");
                setPreview(null);
              }}
            >
              <Trash2 /> Remove
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or SVG up to {maxMb} MB. Appears on your quotes and PDFs.</p>
        </div>
      </div>
      {current?.status === "uploading" ? <p className="text-xs text-muted-foreground">Uploading… {current.progress}%</p> : null}
      {current?.status === "processing" ? <p className="text-xs text-muted-foreground">Processing image…</p> : null}
      {current?.status === "error" ? <Alert variant="destructive">{current.error}</Alert> : null}
    </div>
  );
}
