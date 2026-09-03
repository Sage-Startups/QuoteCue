import { parseMarkdown, markdownToPlainText, type BlockNode, type InlineNode } from "@/lib/utils/safe-markdown";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractTemplateVariables(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Returns the list of variables used in the source that are not permitted. */
export function findUnsupportedVariables(source: string, allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  return extractTemplateVariables(source).filter((v) => !allowedSet.has(v));
}

export function substituteVariables(source: string, variables: Record<string, string | number | null | undefined>): string {
  return source.replace(VARIABLE_PATTERN, (_m, name: string) => {
    const value = variables[name];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(nodes: InlineNode[], accent: string): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return escapeHtml(n.value);
        case "strong":
          return `<strong>${renderInline(n.children, accent)}</strong>`;
        case "em":
          return `<em>${renderInline(n.children, accent)}</em>`;
        case "code":
          return `<code style="font-family:Menlo,monospace;background:#f1f5f9;padding:2px 4px;border-radius:4px">${escapeHtml(n.value)}</code>`;
        case "link":
          return `<a href="${escapeHtml(n.href)}" style="color:${accent};text-decoration:underline">${renderInline(n.children, accent)}</a>`;
      }
    })
    .join("");
}

function renderBlock(block: BlockNode, accent: string, primary: string): string {
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 24 : block.level === 2 ? 20 : 17;
      return `<h${block.level} style="margin:0 0 16px;font-size:${size}px;line-height:1.3;color:${primary};font-weight:700">${renderInline(block.children, accent)}</h${block.level}>`;
    }
    case "paragraph": {
      // A paragraph that is only a link becomes a button.
      if (block.children.length === 1 && block.children[0]?.type === "link") {
        const link = block.children[0];
        return `<p style="margin:24px 0"><a href="${escapeHtml(link.href)}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${renderInline(link.children, "#ffffff")}</a></p>`;
      }
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937">${renderInline(block.children, accent)}</p>`;
    }
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag} style="margin:0 0 16px;padding-left:22px;color:#1f2937;font-size:16px;line-height:1.6">${block.items
        .map((item) => `<li>${renderInline(item, accent)}</li>`)
        .join("")}</${tag}>`;
    }
    case "quote":
      return `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:4px solid ${accent};background:#f8fafc;color:#334155">${renderInline(block.children, accent)}</blockquote>`;
    case "hr":
      return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />`;
  }
}

export interface EmailBranding {
  productName: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  logoUrl?: string | null;
  appUrl: string;
}

export function renderEmailHtml(bodyMarkdown: string, branding: EmailBranding, previewText?: string): string {
  const blocks = parseMarkdown(bodyMarkdown);
  const body = blocks.map((b) => renderBlock(b, branding.accentColor, branding.primaryColor)).join("");
  const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}</div>` : "";
  const logo = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.productName)}" height="36" style="height:36px" />`
    : `<span style="font-size:20px;font-weight:800;color:${branding.primaryColor};letter-spacing:-0.02em">${escapeHtml(branding.productName)}</span>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(branding.productName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${preview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="padding:24px 32px;border-bottom:1px solid #eef0f3">${logo}</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.5">${escapeHtml(branding.footerText)}<br /><a href="${escapeHtml(branding.appUrl)}" style="color:#64748b">${escapeHtml(branding.appUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(bodyMarkdown: string, branding: EmailBranding): string {
  return `${markdownToPlainText(bodyMarkdown)}\n\n--\n${branding.footerText}\n${branding.appUrl}`;
}
