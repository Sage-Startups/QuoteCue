"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SeriesSpec {
  key: string;
  name: string;
  color: string;
}

function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

const AXIS = { fontSize: 11, fill: "#5b6474" };
const TOOLTIP = { borderRadius: 8, borderColor: "#e2e6ec", fontSize: 12 };

/** Multi-series daily chart used across the admin dashboard. */
export function AdminSeriesChart({ data, series, type = "bar", label, height = 256, formatter }: { data: Array<Record<string, string | number>>; series: SeriesSpec[]; type?: "bar" | "line"; label: string; height?: number; formatter?: (v: number) => string }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  const common = {
    data,
    margin: { top: 8, right: 8, left: -8, bottom: 0 },
  };
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "line" ? (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatter ? (v) => formatter(Number(v)) : undefined} allowDecimals={false} />
            <Tooltip labelFormatter={(l) => shortDay(String(l))} formatter={formatter ? (v) => formatter(Number(v)) : undefined} contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatter ? (v) => formatter(Number(v)) : undefined} allowDecimals={false} />
            <Tooltip labelFormatter={(l) => shortDay(String(l))} formatter={formatter ? (v) => formatter(Number(v)) : undefined} contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal-category bar chart (e.g. by feature, by model). */
export function CategoryBarChart({ data, xKey, yKey, name, color = "#2b4a86", label, formatter, height = 224 }: { data: Array<Record<string, string | number>>; xKey: string; yKey: string; name: string; color?: string; label: string; formatter?: (v: number) => string; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatter ? (v) => formatter(Number(v)) : undefined} />
          <Tooltip formatter={formatter ? (v) => formatter(Number(v)) : undefined} contentStyle={TOOLTIP} />
          <Bar dataKey={yKey} name={name} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
