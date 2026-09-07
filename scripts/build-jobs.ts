/**
 * Bundles the cron job runner and the seed into dist/ for the Docker image,
 * which copies that directory to /app/jobs with the production node_modules
 * beside it. Dependencies must resolve by walking up from the bundle's own
 * directory: NODE_PATH covers `require` but not the dynamic `import()` the
 * Prisma client uses internally.
 * Node modules stay external and are resolved from the production node_modules.
 */
import { build } from "esbuild";
import path from "node:path";

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  packages: "external",
  alias: { "@": path.resolve(__dirname, "../src") },
  // The generated Prisma client reads `import.meta.url`, which is empty in a
  // CommonJS bundle and made the runner crash on load. Point it at the bundle's
  // own path so the client resolves its runtime correctly.
  banner: { js: "const __bundleImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  define: { "process.env.JOBS_BUNDLE": '"1"', "import.meta.url": "__bundleImportMetaUrl" },
  logLevel: "info",
} as const;

async function main() {
  await build({
    ...common,
    entryPoints: [path.resolve(__dirname, "../src/jobs/run.ts")],
    outfile: path.resolve(__dirname, "../dist/run.js"),
  });
  // The seed is bundled too: tsx is a dev dependency and is pruned from the
  // image, so `tsx prisma/seed.ts` cannot run inside a container.
  await build({
    ...common,
    entryPoints: [path.resolve(__dirname, "../src/lib/seed/cli.ts")],
    outfile: path.resolve(__dirname, "../dist/seed.js"),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
