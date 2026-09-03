import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">The page you are looking for does not exist or may have moved.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">Go to homepage</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
