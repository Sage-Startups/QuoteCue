import { disconnectPrisma } from "@/lib/db";
import { runSeed } from "@/lib/seed/run";

/** Entry point bundled to dist/seed.js and run by `./docker/entrypoint.sh seed`. */
runSeed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
