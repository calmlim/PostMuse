import type { SecretBinding, SecretPersistence, SecretStatus } from "../core/settings/types";
import { isRecordValue } from "../core/settings/validation";

export const SECRETS_STORAGE_KEY = "postmuse.secrets";

interface BoundSecretV1 {
  schemaVersion: 1;
  value: string;
  scope: SecretBinding["scope"];
  provider: SecretBinding["provider"];
  origin: string;
}

type StoredSecret = string | BoundSecretV1;
type SecretBag = Record<string, StoredSecret>;

const getArea = (persistence: SecretPersistence): chrome.storage.StorageArea =>
  persistence === "local" ? chrome.storage.local : chrome.storage.session;

const isBoundSecretV1 = (value: unknown): value is BoundSecretV1 =>
  isRecordValue(value) &&
  value.schemaVersion === 1 &&
  typeof value.value === "string" &&
  (value.scope === "text" || value.scope === "image") &&
  typeof value.provider === "string" &&
  typeof value.origin === "string";

const readSecretBag = async (persistence: SecretPersistence): Promise<SecretBag> => {
  const stored = await getArea(persistence).get(SECRETS_STORAGE_KEY);
  const bag = stored[SECRETS_STORAGE_KEY];

  if (!isRecordValue(bag)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bag).filter(
      (entry): entry is [string, StoredSecret] =>
        typeof entry[1] === "string" || isBoundSecretV1(entry[1]),
    ),
  );
};

const writeSecretBag = async (persistence: SecretPersistence, bag: SecretBag): Promise<void> => {
  await getArea(persistence).set({ [SECRETS_STORAGE_KEY]: bag });
};

const matchesBinding = (secret: BoundSecretV1, binding: SecretBinding): boolean =>
  secret.scope === binding.scope &&
  secret.provider === binding.provider &&
  secret.origin === binding.origin;

export const saveApiKey = async (
  binding: SecretBinding,
  apiKey: string,
  persistence: SecretPersistence,
): Promise<void> => {
  const normalizedKey = apiKey.trim();

  if (!normalizedKey) {
    throw new Error("API key cannot be empty.");
  }

  const targetBag = await readSecretBag(persistence);
  const secret: BoundSecretV1 = {
    schemaVersion: 1,
    value: normalizedKey,
    scope: binding.scope,
    provider: binding.provider,
    origin: binding.origin,
  };
  await writeSecretBag(persistence, { ...targetBag, [binding.profileId]: secret });

  const otherPersistence: SecretPersistence = persistence === "local" ? "session" : "local";
  const otherBag = await readSecretBag(otherPersistence);
  if (binding.profileId in otherBag) {
    delete otherBag[binding.profileId];
    await writeSecretBag(otherPersistence, otherBag);
  }
};

export const readApiKey = async (
  binding: SecretBinding,
  persistence: SecretPersistence,
): Promise<string | undefined> => {
  const secret = (await readSecretBag(persistence))[binding.profileId];
  return isBoundSecretV1(secret) && matchesBinding(secret, binding) ? secret.value : undefined;
};

export const getSecretStatus = async (binding: SecretBinding): Promise<SecretStatus> => {
  const [sessionBag, localBag] = await Promise.all([
    readSecretBag("session"),
    readSecretBag("local"),
  ]);
  const sessionSecret = sessionBag[binding.profileId];
  const localSecret = localBag[binding.profileId];

  if (isBoundSecretV1(sessionSecret) && matchesBinding(sessionSecret, binding)) {
    return { hasKey: true, persistence: "session" };
  }
  if (isBoundSecretV1(localSecret) && matchesBinding(localSecret, binding)) {
    return { hasKey: true, persistence: "local" };
  }

  return {
    hasKey: false,
    ...(sessionSecret !== undefined || localSecret !== undefined ? { requiresReentry: true } : {}),
  };
};

export const deleteApiKey = async (profileId: string): Promise<void> => {
  for (const persistence of ["session", "local"] as const) {
    const bag = await readSecretBag(persistence);
    if (profileId in bag) {
      delete bag[profileId];
      await writeSecretBag(persistence, bag);
    }
  }
};

export const deleteAllApiKeys = async (): Promise<void> => {
  await Promise.all([
    chrome.storage.local.remove(SECRETS_STORAGE_KEY),
    chrome.storage.session.remove(SECRETS_STORAGE_KEY),
  ]);
};
