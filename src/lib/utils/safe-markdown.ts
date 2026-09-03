/**
 * A deliberately restricted Markdown model. Only a tiny subset is supported and
 * no raw HTML is ever emitted. Rendering is done by React components that escape
 * all text, so admin-editable content cannot inject markup.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode =
  | { type: "heading"; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "hr" };

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim());
}

/** Underscore emphasis only opens at a word boundary (as in CommonMark), so snake_case_words stay intact. */
function isWordBoundaryBefore(text: string, index: number): boolean {
  return index === 0 || !/[A-Za-z0-9]/.test(text[index - 1]!);
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  let buffer = "";
  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpMatchArray | null;
    // Bare URLs are taken verbatim so that `_` or `*` inside a token (public
    // quote links, unsubscribe links) is never parsed as emphasis.
    if ((m = rest.match(/^https?:\/\/[^\s<>"']+/))) {
      const prev = i > 0 ? text[i - 1]! : " ";
      if (!/[\w(]/.test(prev)) {
        flush();
        const href = m[0].replace(/[.,;:!?)]+$/, "");
        nodes.push({ type: "link", href, children: [{ type: "text", value: href }] });
        i += href.length;
        continue;
      }
    }
    if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      flush();
      nodes.push({ type: "strong", children: parseInline(m[1]!) });
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^\*(?=\S)(.+?)(?<=\S)\*/) ?? (isWordBoundaryBefore(text, i) ? rest.match(/^_(?=\S)(.+?)(?<=\S)_(?![A-Za-z0-9])/) : null))) {
      flush();
      nodes.push({ type: "em", children: parseInline(m[1]!) });
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      nodes.push({ type: "code", value: m[1]! });
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush();
      const href = m[2]!;
      if (isSafeHref(href)) {
        nodes.push({ type: "link", href, children: parseInline(m[1]!) });
      } else {
        nodes.push({ type: "text", value: m[1]! });
      }
      i += m[0].length;
      continue;
    }
    buffer += text[i];
    i++;
  }
  flush();
  return nodes;
}

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: m[1]!.length as 1 | 2 | 3, children: parseInline(m[2]!) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", children: parseInline(m[1]!) });
      continue;
    }
    if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(m[1]!);
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(m[1]!);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function markdownToPlainText(source: string): string {
  return parseMarkdown(source)
    .map((b) => {
      const inline = (nodes: InlineNode[]): string =>
        nodes
          .map((n) => {
            if (n.type === "text" || n.type === "code") return n.value;
            return inline(n.children);
          })
          .join("");
      switch (b.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return inline(b.children);
        case "list":
          return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${inline(it)}`).join("\n");
        case "hr":
          return "---";
      }
    })
    .join("\n\n");
}
