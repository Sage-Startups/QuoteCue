"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-destructive">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">We hit an unexpected error</h1>
      <p className="mt-2 max-w-md text-muted-foreground">The problem has been recorded. Please try again, and contact support if it keeps happening.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button className="mt-6" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
