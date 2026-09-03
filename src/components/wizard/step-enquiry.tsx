"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, FileAudio, FileText, ImagePlus, Loader2, Trash2, Upload, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, Alert, Progress } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUploader, formatBytes } from "@/components/uploads/use-upload";
import { saveEnquiryAction, removeMediaAction, transcribeAction } from "@/app/app/quotes/[id]/edit/actions";
import { VoiceRecorder } from "./voice-recorder";
import type { WizardData, WizardMedia } from "./types";

export function StepEnquiry({ data }: { data: WizardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enquiryText, setEnquiryText] = useState(data.quote.enquiryText);
  const [jobNotes, setJobNotes] = useState(data.quote.jobNotes);
  const [transcript, setTranscript] = useState(data.quote.transcript);
  const [media, setMedia] = useState<WizardMedia[]>(data.media);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const images = useUploader({ purpose: "QUOTE_IMAGE", quoteId: data.quote.id, attachAs: "IMAGE" });
  const audio = useUploader({ purpose: "QUOTE_AUDIO", quoteId: data.quote.id, attachAs: "AUDIO" });
  const docs = useUploader({ purpose: "QUOTE_DOCUMENT", quoteId: data.quote.id, attachAs: "DOCUMENT" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const imageCount = media.filter((m) => m.kind === "IMAGE").length;

  const addMedia = (kind: WizardMedia["kind"], file: File, result: { mediaId: string | null; mimeType: string; sizeBytes: number; previewUrl: string | null }) => {
    if (!result.mediaId) return;
    setMedia((m) => [...m, { id: result.mediaId!, kind, filename: file.name, mimeType: result.mimeType, sizeBytes: result.sizeBytes, previewUrl: result.previewUrl, transcript: null }]);
  };

  const uploadImages = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (imageCount + list.length > data.limits.maxImages) {
        toast.error(`You can attach up to ${data.limits.maxImages} photographs per quote.`);
        return;
      }
    for (const file of list) {
      const result = await images.upload(file);
      if (result) addMedia("IMAGE", file, result);
    }
  };

  const transcribe = async (mediaId: string) => {
    setTranscribing(mediaId);
    const result = await transcribeAction(data.quote.id, mediaId);
    setTranscribing(null);
    if (!result.ok) {
        toast.error(result.error);
        return;
      }
    toast.success(result.message ?? "Transcribed");
    setTranscript((t) => [t, result.data.transcript].filter((x) => x && x.trim()).join("\n\n"));
    setMedia((m) => m.map((x) => (x.id === mediaId ? { ...x, transcript: result.data.transcript } : x)));
  };

  const uploadAudio = async (file: File) => {
    const result = await audio.upload(file);
    if (result?.mediaId) {
      addMedia("AUDIO", file, result);
      await transcribe(result.mediaId);
    }
  };

  const remove = (m: WizardMedia) =>
    start(async () => {
      const result = await removeMediaAction(data.quote.id, m.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMedia((list) => list.filter((x) => x.id !== m.id));
    });

  const save = (nextStep: number) =>
    start(async () => {
      const result = await saveEnquiryAction(data.quote.id, { enquiryText, jobNotes, transcript });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/app/quotes/${data.quote.id}/edit?step=${nextStep}`);
      router.refresh();
    });

  const hasAnything = enquiryText.trim() || jobNotes.trim() || transcript.trim() || media.length > 0;
  const activeUploads = [...images.uploads, ...audio.uploads, ...docs.uploads].filter((u) => u.status !== "done");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer message</CardTitle>
          <CardDescription>Paste the WhatsApp, text, email or web enquiry exactly as you received it.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Enquiry" htmlFor="enquiryText">
            <Textarea id="enquiryText" value={enquiryText} onChange={(e) => setEnquiryText(e.target.value)} rows={6} placeholder="Hi, could you quote for two new double sockets in the living room and…" maxLength={8000} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your job notes</CardTitle>
          <CardDescription>Rough notes are fine: measurements, access, materials, anything you spotted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Notes" htmlFor="jobNotes">
            <Textarea id="jobNotes" value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} rows={4} placeholder="Consumer unit in garage, solid walls, customer supplying fittings…" maxLength={8000} />
          </Field>
        </CardContent>
      </Card>
      {data.flags.voice ? (
        <Card>
          <CardHeader>
            <CardTitle>Voice note</CardTitle>
            <CardDescription>Record on site or upload MP3, WAV, M4A or WebM (up to {data.limits.maxAudioMb} MB).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VoiceRecorder onRecorded={uploadAudio} disabled={pending} />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
              <Upload className="size-4" aria-hidden="true" /> Upload audio file
              <input
                type="file"
                accept={data.limits.audioTypes.join(",")}
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await uploadAudio(file);
                }}
              />
            </label>
            {transcript ? (
              <Field label="Transcript" htmlFor="transcript" hint="Edit anything the transcription got wrong.">
                <Textarea id="transcript" value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={5} maxLength={12000} />
              </Field>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Job photographs</CardTitle>
          <CardDescription>
            JPEG, PNG, WebP or HEIC up to {data.limits.maxImageMb} MB each, {data.limits.maxImages} per quote. {data.flags.photos ? "AI describes what is visible and always flags what a photo cannot prove." : "Photo analysis is currently disabled; photos are stored for your reference."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" variant="secondary" className="h-12" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-5" /> Take photo
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={(e) => e.target.files && uploadImages(e.target.files).then(() => (e.target.value = ""))} />
            <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-4 text-sm font-semibold shadow-sm hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
              <ImagePlus className="size-5" aria-hidden="true" /> Add photos
              <input type="file" accept={data.limits.imageTypes.join(",")} multiple className="sr-only" onChange={(e) => e.target.files && uploadImages(e.target.files).then(() => (e.target.value = ""))} />
            </label>
          </div>
          <MediaGrid media={media.filter((m) => m.kind === "IMAGE")} onRemove={remove} pending={pending} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>PDF or plain text up to {data.limits.maxDocumentMb} MB, e.g. a spec or an email thread. Text files are read by the analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
            <FileText className="size-4" aria-hidden="true" /> Add document
            <input
              type="file"
              accept={data.limits.documentTypes.join(",")}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const result = await docs.upload(file);
                if (result) addMedia("DOCUMENT", file, result);
              }}
            />
          </label>
          <MediaList media={media.filter((m) => m.kind !== "IMAGE")} onRemove={remove} onTranscribe={transcribe} transcribing={transcribing} pending={pending} />
        </CardContent>
      </Card>
      {activeUploads.length > 0 ? (
        <div className="space-y-2" aria-live="polite">
          {activeUploads.map((u) => (
            <div key={u.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {u.file.name} <span className="text-xs text-muted-foreground">({formatBytes(u.file.size)})</span>
                </span>
                {u.status === "error" ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => (images.uploads.includes(u) ? images.retry(u.id) : audio.uploads.includes(u) ? audio.retry(u.id) : docs.retry(u.id))}>
                      <RefreshCw /> Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (images.uploads.includes(u) ? images.remove(u.id) : audio.uploads.includes(u) ? audio.remove(u.id) : docs.remove(u.id))} aria-label="Dismiss">
                      <X />
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => (images.uploads.includes(u) ? images.cancel(u.id) : audio.uploads.includes(u) ? audio.cancel(u.id) : docs.cancel(u.id))}>
                    Cancel
                  </Button>
                )}
              </div>
              {u.status === "error" ? <p className="mt-1 text-xs text-destructive">{u.error}</p> : <Progress className="mt-2" value={u.progress} label={`Uploading ${u.file.name}`} />}
              {u.status === "processing" ? <p className="mt-1 text-xs text-muted-foreground">Processing…</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {!hasAnything ? <Alert variant="info">Add at least one input (message, notes, voice note or photo) to run the AI analysis. You can also skip straight to pricing.</Alert> : null}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => save(1)} disabled={pending}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save(4)} disabled={pending}>
            Skip AI, price manually
          </Button>
          <Button size="lg" onClick={() => save(3)} loading={pending} disabled={!hasAnything || activeUploads.some((u) => u.status !== "error")}>
            Save and analyse
          </Button>
        </div>
      </div>
    </div>
  );
}

function MediaGrid({ media, onRemove, pending }: { media: WizardMedia[]; onRemove: (m: WizardMedia) => void; pending: boolean }) {
  if (media.length === 0) return <p className="text-sm text-muted-foreground">No photographs yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {media.map((m) => (
        <li key={m.id} className="group relative overflow-hidden rounded-lg border bg-muted">
          {m.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.previewUrl} alt={m.filename} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-muted-foreground">
              <ImagePlus />
            </div>
          )}
          <button type="button" onClick={() => onRemove(m)} disabled={pending} className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-foreground shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Remove ${m.filename}`}>
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MediaList({ media, onRemove, onTranscribe, transcribing, pending }: { media: WizardMedia[]; onRemove: (m: WizardMedia) => void; onTranscribe: (id: string) => void; transcribing: string | null; pending: boolean }) {
  if (media.length === 0) return <p className="text-sm text-muted-foreground">No audio or documents yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {media.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            {m.kind === "AUDIO" ? <FileAudio className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{m.filename}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(m.sizeBytes)}</span>
            {m.kind === "AUDIO" ? m.transcript ? <Badge variant="success">Transcribed</Badge> : <Badge variant="warning">Not transcribed</Badge> : null}
          </span>
          <span className="flex gap-1">
            {m.kind === "AUDIO" ? (
              <Button size="sm" variant="ghost" onClick={() => onTranscribe(m.id)} disabled={transcribing === m.id}>
                {transcribing === m.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} {m.transcript ? "Re-transcribe" : "Transcribe"}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onRemove(m)} disabled={pending} aria-label={`Remove ${m.filename}`}>
              <Trash2 />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
