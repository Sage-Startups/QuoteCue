import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/**
 * The Docker image runs `pnpm prune --prod`, so anything it still executes may
 * only reach production dependencies. `prisma.config.ts` is copied into the
 * image and loaded by every `prisma migrate deploy`; a static `import
 * "dotenv/config"` there crash-looped the container while working locally,
 * where dev dependencies are installed.
 */
describe("files shipped in the Docker image", () => {
  const devDeps = Object.keys(pkg.devDependencies);

  it("prisma.config.ts imports no dev dependency", () => {
    const source = readFileSync(path.join(root, "prisma.config.ts"), "utf8");
    const imported = [...source.matchAll(/^\s*import\s+(?:.*?\s+from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]!);
    const packages = imported.filter((s) => !s.startsWith(".") && !s.startsWith("node:"));
    const offending = packages.filter((s) => devDeps.some((d) => s === d || s.startsWith(`${d}/`)));
    expect(offending, `dev dependencies are pruned from the image: ${offending.join(", ")}`).toEqual([]);
  });

  it("keeps the Prisma CLI in production dependencies for the migrate entrypoint", () => {
    expect(Object.keys(pkg.dependencies)).toContain("prisma");
  });
});
