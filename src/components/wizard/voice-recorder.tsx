"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/** Large, one-handed voice recording control using the MediaRecorder API. */
export function VoiceRecorder({ onRecorded, disabled, maxSeconds = 300 }: { onRecorded: (file: File) => Promise<void>; disabled?: boolean; maxSeconds?: number }) {
  const [supported] = useState(() => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState("audio/webm");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = pickMimeType();
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const finalType = rec.mimeType || type || "audio/webm";
        const b = new Blob(chunks.current, { type: finalType });
        setMime(finalType);
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxSeconds) stop();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser settings or upload an audio file instead." : "Could not start recording on this device. Upload an audio file instead.");
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stop();
    setRecording(false);
  };

  const discard = () => {
    setBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true);
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mime.split(";")[0] });
    await onRecorded(file);
    setSaving(false);
    discard();
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (!supported) return <p className="text-sm text-muted-foreground">Recording is not supported in this browser. Upload an audio file instead.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          {!recording && !blob ? (
            <Button type="button" size="lg" variant="accent" onClick={start} disabled={disabled} className="h-14 min-w-[12rem] text-base">
              <Mic className="size-5" /> Record voice note
            </Button>
          ) : null}
          {recording ? (
            <Button type="button" size="lg" variant="destructive" onClick={stop} className="h-14 min-w-[12rem] text-base">
              <Square className="size-5" /> Stop ({mmss})
            </Button>
          ) : null}
          {recording ? <span className={cn("size-3 animate-pulse rounded-full bg-red-600")} aria-hidden="true" /> : null}
          {recording ? <span className="sr-only" aria-live="polite">Recording, {mmss}</span> : null}
        </div>
        {blob && !recording ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <audio controls src={previewUrl ?? undefined} className="h-10 w-full sm:w-64" aria-label="Recorded voice note" />
            <Button type="button" onClick={save} loading={saving}>
              <Upload /> Use this recording
            </Button>
            <Button type="button" variant="ghost" onClick={discard} disabled={saving}>
              <Trash2 /> Discard
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Up to {Math.round(maxSeconds / 60)} minutes. The recording is transcribed and added to the analysis. Works best in a quiet spot.</p>
    </div>
  );
}
