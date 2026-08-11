import type { SecretPersistence, SecretStatus } from "../core/settings/types";
import { isRecordValue } from "../core/settings/validation";

export const SECRETS_STORAGE_KEY = "postmuse.secrets";

type SecretBag = Record<string, string>;

const getArea = (persistence: SecretPersistence): chrome.storage.StorageArea =>
  persistence === "local" ? chrome.storage.local : chrome.storage.session;

const readSecretBag = async (persistence: SecretPersistence): Promise<SecretBag> => {
  const stored = await getArea(persistence).get(SECRETS_STORAGE_KEY);
  const bag = stored[SECRETS_STORAGE_KEY];

  if (!isRecordValue(bag)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bag).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
};

const writeSecretBag = async (persistence: SecretPersistence, bag: SecretBag): Promise<void> => {
  await getArea(persistence).set({ [SECRETS_STORAGE_KEY]: bag });
};

export const saveApiKey = async (
  profileId: string,
  apiKey: string,
  persistence: SecretPersistence,
): Promise<void> => {
  const normalizedKey = apiKey.trim();

  if (!normalizedKey) {
    throw new Error("API key cannot be empty.");
  }

  const targetBag = await readSecretBag(persistence);
  await writeSecretBag(persistence, { ...targetBag, [profileId]: normalizedKey });

  const otherPersistence: SecretPersistence = persistence === "local" ? "session" : "local";
  const otherBag = await readSecretBag(otherPersistence);
  if (profileId in otherBag) {
    delete otherBag[profileId];
    await writeSecretBag(otherPersistence, otherBag);
  }
};

export const readApiKey = async (
  profileId: string,
  persistence: SecretPersistence,
): Promise<string | undefined> => {
  const bag = await readSecretBag(persistence);
  return bag[profileId];
};

export const getSecretStatus = async (profileId: string): Promise<SecretStatus> => {
  const [sessionKey, localKey] = await Promise.all([
    readApiKey(profileId, "session"),
    readApiKey(profileId, "local"),
  ]);

  if (sessionKey) {
    return { hasKey: true, persistence: "session" };
  }

  if (localKey) {
    return { hasKey: true, persistence: "local" };
  }

  return { hasKey: false };
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
