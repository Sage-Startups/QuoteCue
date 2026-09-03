"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils/money";
import type { Currency } from "@/generated/prisma/enums";

const COLORS = { created: "#7f97c8", sent: "#2b4a86", accepted: "#15803d", declined: "#b91c1c", value: "#0f1f3d", accepted_value: "#d97706" };

function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

export function QuoteActivityChart({ data }: { data: Array<{ day: string; created: number; sent: number; accepted: number }> }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Quotes created, sent and accepted per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(l) => shortDay(String(l))} contentStyle={{ borderRadius: 8, borderColor: "#e2e6ec", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="created" name="Created" fill={COLORS.created} radius={[3, 3, 0, 0]} />
          <Bar dataKey="sent" name="Sent" fill={COLORS.sent} radius={[3, 3, 0, 0]} />
          <Bar dataKey="accepted" name="Accepted" fill={COLORS.accepted} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuoteValueChart({ data, currency }: { data: Array<{ day: string; valueQuotedMinor: number; valueAcceptedMinor: number }>; currency: Currency }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Value quoted and accepted per day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="quoted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.value} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.value} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="accepted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.accepted_value} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.accepted_value} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={(v) => formatMoney(Number(v), currency).replace(/\.00$/, "")} tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} width={70} />
          <Tooltip labelFormatter={(l) => shortDay(String(l))} formatter={(v) => formatMoney(Number(v), currency)} contentStyle={{ borderRadius: 8, borderColor: "#e2e6ec", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="valueQuotedMinor" name="Quoted" stroke={COLORS.value} fill="url(#quoted)" strokeWidth={2} />
          <Area type="monotone" dataKey="valueAcceptedMinor" name="Accepted" stroke={COLORS.accepted_value} fill="url(#accepted)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = { DRAFT: "#94a3b8", READY: "#64748b", SENT: "#2b4a86", VIEWED: "#d97706", ACCEPTED: "#15803d", DECLINED: "#b91c1c", EXPIRED: "#a16207", ARCHIVED: "#cbd5e1" };

export function StatusPieChart({ data }: { data: Array<{ status: string; count: number }> }) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No quotes yet.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label="Quotes by status">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={filtered} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {filtered.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [String(v), String(n).charAt(0) + String(n).slice(1).toLowerCase()]} contentStyle={{ borderRadius: 8, borderColor: "#e2e6ec", fontSize: 12 }} />
          <Legend formatter={(v) => String(v).charAt(0) + String(v).slice(1).toLowerCase()} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBarChart({ data, xKey, yKey, name, color = "#2b4a86", formatter }: { data: Array<Record<string, string | number>>; xKey: string; yKey: string; name: string; color?: string; formatter?: (v: number) => string }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={name}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fontSize: 11, fill: "#5b6474" }} axisLine={false} tickLine={false} tickFormatter={formatter ? (v) => formatter(Number(v)) : undefined} />
          <Tooltip formatter={formatter ? (v) => formatter(Number(v)) : undefined} contentStyle={{ borderRadius: 8, borderColor: "#e2e6ec", fontSize: 12 }} />
          <Bar dataKey={yKey} name={name} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
