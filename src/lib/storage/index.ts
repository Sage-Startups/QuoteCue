import { getEnv } from "@/lib/env";
import { InMemoryStorage } from "./memory";
import { LocalFileStorage } from "./local";
import { RailwayBucketStorage } from "./railway";
import type { StorageProvider } from "./types";

const globalRef = globalThis as unknown as { __storageProvider?: StorageProvider };

export function getStorage(): StorageProvider {
  if (globalRef.__storageProvider) return globalRef.__storageProvider;
  const env = getEnv();
  let provider: StorageProvider;
  switch (env.providers.storage) {
    case "railway":
    case "s3":
      provider = new RailwayBucketStorage();
      break;
    case "memory":
      provider = new InMemoryStorage();
      break;
    case "local":
    default:
      provider = new LocalFileStorage();
  }
  globalRef.__storageProvider = provider;
  return provider;
}

/** Test helper to swap the provider. */
export function setStorageProvider(provider: StorageProvider | undefined): void {
  globalRef.__storageProvider = provider;
}

export type { StorageProvider, PresignedUpload } from "./types";
export { buildObjectKey, extensionForMime, isSafeObjectKey } from "./keys";
