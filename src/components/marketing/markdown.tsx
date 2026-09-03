import type { ReactNode } from "react";
import Link from "next/link";
import { parseMarkdown, type BlockNode, type InlineNode } from "@/lib/utils/safe-markdown";
import { cn } from "@/lib/utils/cn";

/**
 * Renders the restricted Markdown model from `safe-markdown` as React. All
 * text is escaped by React; only a fixed set of elements is ever produced.
 */

function renderInline(nodes: InlineNode[], keyPrefix = "i"): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "code":
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
            {node.value}
          </code>
        );
      case "link": {
        const external = /^https?:\/\//i.test(node.href);
        const className = "font-medium text-primary underline underline-offset-4 hover:text-navy-600";
        if (external) {
          return (
            <a key={key} href={node.href} rel="noopener noreferrer" target="_blank" className={className}>
              {renderInline(node.children, key)}
            </a>
          );
        }
        if (node.href.startsWith("mailto:")) {
          return (
            <a key={key} href={node.href} rel="noopener" className={className}>
              {renderInline(node.children, key)}
            </a>
          );
        }
        return (
          <Link key={key} href={node.href} rel="noopener" className={className}>
            {renderInline(node.children, key)}
          </Link>
        );
      }
    }
  });
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function headingTag(level: 1 | 2 | 3, offset: number): HeadingTag {
  const resolved = Math.min(6, Math.max(1, level + offset));
  return `h${resolved}` as HeadingTag;
}

const headingClasses: Record<HeadingTag, string> = {
  h1: "text-3xl font-bold tracking-tight md:text-4xl",
  h2: "mt-10 text-2xl font-bold tracking-tight first:mt-0 md:text-3xl",
  h3: "mt-8 text-xl font-semibold tracking-tight first:mt-0",
  h4: "mt-6 text-lg font-semibold first:mt-0",
  h5: "mt-4 text-base font-semibold",
  h6: "mt-4 text-sm font-semibold uppercase tracking-wide",
};

function renderBlock(block: BlockNode, index: number, headingOffset: number): ReactNode {
  const key = `b-${index}`;
  switch (block.type) {
    case "heading": {
      const Tag = headingTag(block.level, headingOffset);
      return (
        <Tag key={key} className={cn("scroll-mt-24 text-foreground", headingClasses[Tag])}>
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed">
          {renderInline(block.children, key)}
        </p>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={`${key}-${i}`} className="pl-1 leading-relaxed">
          {renderInline(item, `${key}-${i}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} className="list-decimal space-y-1.5 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1.5 pl-6">
          {items}
        </ul>
      );
    }
    case "quote":
      return (
        <blockquote key={key} className="border-l-4 border-amber-400 pl-4 text-muted-foreground italic">
          {renderInline(block.children, key)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="my-8 border-border" />;
  }
}

export interface MarkdownProps {
  source: string;
  /** Shifts heading levels so admin content cannot introduce a second h1. Default 1 (# → h2). */
  headingOffset?: number;
  className?: string;
}

export function Markdown({ source, headingOffset = 1, className }: MarkdownProps) {
  const blocks = parseMarkdown(source);
  return <div className={cn("space-y-4 text-base text-foreground/90", className)}>{blocks.map((block, i) => renderBlock(block, i, headingOffset))}</div>;
}
