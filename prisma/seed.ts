import "dotenv/config";
import { disconnectPrisma } from "../src/lib/db";
import { runSeed } from "../src/lib/seed/run";

runSeed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
