import { disconnectPrisma } from "@/lib/db";
import { runOps } from "@/lib/ops/run";

/** Entry point bundled to dist/ops.js and run by `./docker/entrypoint.sh ops`. */
runOps(process.argv.slice(2))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
