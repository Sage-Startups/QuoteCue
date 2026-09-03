import type { ZodError } from "zod";

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      if (Array.isArray(obj[k])) (obj[k] as unknown[]).push(value);
      else obj[k] = [value];
    } else if (key in obj) {
      const existing = obj[key];
      obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      obj[key] = value;
    }
  }
  return obj;
}
