export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workspace";
}

export function truncate(input: string, max = 120): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalisePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function splitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function joinLines(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}
