import { headers } from "next/headers";

/**
 * Renders a JSON-LD structured data block. The payload is serialised with
 * JSON.stringify and "<" characters are escaped so admin-editable strings can
 * never close the script element. The CSP nonce is attached for completeness
 * (data blocks are not executed, but this keeps strict CSP reports quiet).
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}
