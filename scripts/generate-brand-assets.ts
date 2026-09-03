/**
 * Generates raster brand assets (PNG icons and the social sharing image) from
 * the SVG sources in public/brand using sharp. Run: pnpm tsx scripts/generate-brand-assets.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

async function main() {
  const mark = await fs.readFile(path.join(publicDir, "brand/logo-mark.svg"));
  await fs.mkdir(path.join(publicDir, "brand"), { recursive: true });
  for (const size of [32, 64, 180, 192, 512]) {
    const out = size === 180 ? path.join(root, "src/app/apple-icon.png") : path.join(publicDir, `brand/icon-${size}.png`);
    await sharp(mark).resize(size, size).png().toFile(out);
  }
  await sharp(mark).resize(32, 32).png().toFile(path.join(publicDir, "favicon-32.png"));

  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f1f3d"/>
        <stop offset="1" stop-color="#1c355f"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <g transform="translate(90 90) scale(1.6)">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#ffffff"/>
      <path d="M20 14h16l8 8v12" fill="none" stroke="#0f1f3d" stroke-opacity="0.3" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M36 14v8h8" fill="none" stroke="#0f1f3d" stroke-opacity="0.3" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="30" cy="36" r="13" fill="none" stroke="#0f1f3d" stroke-width="5"/>
      <path d="M36 42l12 12" stroke="#0f1f3d" stroke-width="5" stroke-linecap="round"/>
      <path d="M38 46l5 5 11-12" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="215" y="158" font-family="Geist, Inter, -apple-system, Segoe UI, Roboto, sans-serif" font-size="56" font-weight="800" fill="#ffffff" letter-spacing="-2">QuoteCue <tspan fill="#fbbf24" font-weight="500">AI</tspan></text>
    <text x="90" y="330" font-family="Geist, Inter, -apple-system, Segoe UI, Roboto, sans-serif" font-size="64" font-weight="800" fill="#ffffff" letter-spacing="-2">Turn job enquiries into</text>
    <text x="90" y="405" font-family="Geist, Inter, -apple-system, Segoe UI, Roboto, sans-serif" font-size="64" font-weight="800" fill="#fbbf24" letter-spacing="-2">professional quotes in minutes.</text>
    <text x="90" y="490" font-family="Geist, Inter, -apple-system, Segoe UI, Roboto, sans-serif" font-size="30" font-weight="400" fill="#c7d2e6">Messages, voice notes and job photos in. Branded, accepted quotes out.</text>
    <rect x="90" y="540" width="280" height="4" rx="2" fill="#f59e0b"/>
  </svg>`;
  await sharp(Buffer.from(og)).png().toFile(path.join(publicDir, "og-image.png"));
  await sharp(Buffer.from(og)).png().toFile(path.join(root, "src/app/opengraph-image.png"));
  console.log("Brand assets generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
