import "dotenv/config";
import { disconnectPrisma } from "../src/lib/db";
import { seedPlatform } from "../src/lib/seed/platform";
import { seedDemoWorkspace } from "../src/lib/seed/demo";

/** Rebuilds the Northstar Electrical Services demo workspace. Usage: pnpm demo:reset */
async function main() {
  const log = (m: string) => console.log(`[demo] ${m}`);
  await seedPlatform({ log });
  await seedDemoWorkspace({ log });
  log("Demo workspace reset complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
