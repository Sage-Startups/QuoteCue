import { execSync } from "node:child_process";

/** Applies migrations to the test database once before the suite runs. */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/quotecue_test";
  execSync("pnpm prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
