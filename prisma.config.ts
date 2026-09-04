import { defineConfig, env } from "prisma/config";

// The production image prunes dev dependencies, so dotenv is not installed
// there and the container already has DATABASE_URL in its environment. Load it
// only when present, otherwise the CLI cannot read this config file at all.
declare const require: ((id: string) => unknown) | undefined;
try {
  require?.("dotenv/config");
} catch {
  // Not installed: rely on the ambient environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
