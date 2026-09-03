import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";

const root = path.resolve(__dirname, "../..");
const runner = path.join(root, "dist/jobs/run.js");
const seed = path.join(root, "dist/seed.js");

/**
 * The bundles are what the Docker image actually executes, and they are built
 * with different settings from the TypeScript the other tests import. A CommonJS
 * bundle left `import.meta.url` undefined, so the generated Prisma client threw
 * on load and every cron run crashed - invisible to tests that import source.
 * `--list` loads the whole module graph without touching the database.
 */
describe("job and seed bundles", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["jobs:build"], { cwd: root, stdio: "ignore" });
  }, 120_000);

  it("builds both bundles", () => {
    expect(existsSync(runner)).toBe(true);
    expect(existsSync(seed)).toBe(true);
  });

  it("loads the runner and lists every job", () => {
    const out = execFileSync("node", [runner, "--list"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("heartbeat");
    expect(out).toContain("expire-overdue-quotes");
    expect(out.trim().split("\n")).toHaveLength(9);
  });
});
