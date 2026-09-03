/**
 * Bundles the cron job runner into dist/jobs/run.js for the Docker image.
 * Node modules stay external and are resolved from the production node_modules.
 */
import { build } from "esbuild";
import path from "node:path";

async function main() {
  await build({
    entryPoints: [path.resolve(__dirname, "../src/jobs/run.ts")],
    outfile: path.resolve(__dirname, "../dist/jobs/run.js"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    sourcemap: false,
    packages: "external",
    alias: { "@": path.resolve(__dirname, "../src") },
    define: { "process.env.JOBS_BUNDLE": '"1"' },
    logLevel: "info",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
