"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, formatRelative } from "@/lib/utils/dates";
import type { Currency, QuoteStatus } from "@/generated/prisma/enums";
import { bulkArchiveAction } from "@/app/app/quotes/actions";

export interface QuoteRow {
  id: string;
  number: string;
  title: string;
  status: QuoteStatus;
  totalMinor: number;
  currency: Currency;
  customerName: string;
  createdAt: string;
  sentAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export function QuoteListClient({ rows, readOnly }: { rows: QuoteRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const archive = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("ids", selected.join(","));
      const result = await bulkArchiveAction(fd);
      if (result.ok) {
        toast.success(result.message ?? "Archived");
        setSelected([]);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <div className="space-y-3">
      {!readOnly && selected.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2 text-sm">
          <span>{selected.length} selected</span>
          <Button size="sm" variant="secondary" onClick={archive} loading={pending}>
            <Archive /> Archive selected
          </Button>
        </div>
      ) : null}
      <div className="space-y-3 md:hidden">
        {rows.map((q) => (
          <Link key={q.id} href={`/app/quotes/${q.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{q.number}</p>
                <p className="truncate font-semibold">{q.title}</p>
                <p className="truncate text-sm text-muted-foreground">{q.customerName}</p>
              </div>
              <QuoteStatusBadge status={q.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</span>
              <span className="text-xs text-muted-foreground">{formatRelative(new Date(q.updatedAt))}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {!readOnly ? (
                <TableHead className="w-10">
                  <Checkbox aria-label="Select all" checked={allSelected} onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])} />
                </TableHead>
              ) : null}
              <TableHead>Quote</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((q) => (
              <TableRow key={q.id} data-state={selected.includes(q.id) ? "selected" : undefined}>
                {!readOnly ? (
                  <TableCell>
                    <Checkbox aria-label={`Select ${q.number}`} checked={selected.includes(q.id)} onCheckedChange={() => toggle(q.id)} />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link href={`/app/quotes/${q.id}`} className="font-semibold hover:underline">
                    {q.number}
                  </Link>
                  <p className="max-w-[18rem] truncate text-xs text-muted-foreground">{q.title}</p>
                </TableCell>
                <TableCell className="max-w-[12rem] truncate">{q.customerName}</TableCell>
                <TableCell>
                  <QuoteStatusBadge status={q.status} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(new Date(q.createdAt))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{q.sentAt ? formatDate(new Date(q.sentAt)) : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{q.expiresAt ? formatDate(new Date(q.expiresAt)) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
