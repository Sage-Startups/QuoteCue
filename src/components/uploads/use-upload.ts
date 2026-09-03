"use client";

import { useCallback, useRef, useState } from "react";

export type UploadPurpose = "LOGO" | "QUOTE_IMAGE" | "QUOTE_AUDIO" | "QUOTE_DOCUMENT" | "SITE_ASSET";

export interface UploadResult {
  storedObjectId: string;
  mediaId: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
}

export interface UploadState {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
  result?: UploadResult;
}

/**
 * Presigned upload flow: request URL → PUT directly to storage → finalize.
 * Progress is reported from the XHR upload so the UI can show a bar.
 */
export function useUploader(options: { purpose: UploadPurpose; quoteId?: string; attachAs?: "IMAGE" | "AUDIO" | "DOCUMENT" }) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());

  const update = useCallback((id: string, patch: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploads((prev) => [...prev, { id, file, progress: 0, status: "uploading" }]);
      try {
        const presign = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: options.purpose, filename: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, quoteId: options.quoteId }),
        });
        const presignBody = (await presign.json()) as { error?: string; uploadId: string; url: string; headers: Record<string, string> };
        if (!presign.ok) throw new Error(presignBody.error ?? "Could not start the upload");

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrs.current.set(id, xhr);
          xhr.open("PUT", presignBody.url);
          for (const [k, v] of Object.entries(presignBody.headers ?? {})) xhr.setRequestHeader(k, v);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) update(id, { progress: Math.round((e.loaded / e.total) * 100) });
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status})`)));
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("Upload cancelled"));
          xhr.send(file);
        });
        xhrs.current.delete(id);
        update(id, { status: "processing", progress: 100 });

        const finalize = await fetch("/api/uploads/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: presignBody.uploadId, quoteId: options.quoteId, attachAs: options.attachAs }),
        });
        const result = (await finalize.json()) as UploadResult & { error?: string };
        if (!finalize.ok) throw new Error(result.error ?? "Could not finish the upload");
        update(id, { status: "done", result });
        return result;
      } catch (error) {
        update(id, { status: "error", error: (error as Error).message });
        return null;
      }
    },
    [options.purpose, options.quoteId, options.attachAs, update],
  );

  const cancel = useCallback((id: string) => {
    xhrs.current.get(id)?.abort();
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const remove = useCallback((id: string) => setUploads((prev) => prev.filter((u) => u.id !== id)), []);
  const retry = useCallback(
    async (id: string) => {
      const existing = uploads.find((u) => u.id === id);
      if (!existing) return null;
      setUploads((prev) => prev.filter((u) => u.id !== id));
      return upload(existing.file);
    },
    [uploads, upload],
  );

  return { uploads, upload, cancel, remove, retry };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
