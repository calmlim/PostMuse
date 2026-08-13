import type { GenerationInput, GenerationResult } from "../core/generation/types";
import type { ImageHistoryMetadata } from "../core/image/types";
import {
  HISTORY_LIMIT,
  HISTORY_SCHEMA_VERSION,
  type HistoryRecordV1,
  isHistoryRecordV1,
} from "../core/history/types";

export const HISTORY_DATABASE_NAME = "postmuse";
export const HISTORY_DATABASE_VERSION = 1;
export const HISTORY_STORE_NAME = "history";
export const HISTORY_BYTE_LIMIT = 10 * 1024 * 1024;

const getRecordByteLength = (record: HistoryRecordV1): number =>
  new TextEncoder().encode(JSON.stringify(record)).byteLength;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });

const openHistoryDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DATABASE_NAME, HISTORY_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const store = database.createObjectStore(HISTORY_STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("History database could not be opened."));
  });

const createHistoryId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface SaveHistoryOptions {
  recipeVersion: number;
  styleTemplateVersion: number;
  now?: Date;
}

export const saveHistoryRecord = async (
  input: GenerationInput,
  result: GenerationResult,
  options: SaveHistoryOptions,
): Promise<HistoryRecordV1> => {
  const timestamp = (options.now ?? new Date()).toISOString();
  const record: HistoryRecordV1 = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    id: createHistoryId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    input,
    result,
    prompt: {
      recipeVersion: options.recipeVersion,
      styleTemplateId: input.styleId,
      styleTemplateVersion: options.styleTemplateVersion,
    },
  };
  if (!isHistoryRecordV1(record)) {
    throw new Error("History record failed validation.");
  }

  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    await requestToPromise(store.put(record));
    const orderedRecords = (await requestToPromise(
      store.index("updatedAt").getAll(),
    )) as HistoryRecordV1[];
    let retainedBytes = 0;
    let retainedCount = 0;
    for (let index = orderedRecords.length - 1; index >= 0; index -= 1) {
      const current = orderedRecords[index];
      const currentBytes = getRecordByteLength(current);
      if (retainedCount >= HISTORY_LIMIT || retainedBytes + currentBytes > HISTORY_BYTE_LIMIT) {
        store.delete(current.id);
      } else {
        retainedBytes += currentBytes;
        retainedCount += 1;
      }
    }
    await transactionToPromise(transaction);
    return record;
  } finally {
    database.close();
  }
};

export const listHistoryRecords = async (): Promise<HistoryRecordV1[]> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readonly");
    const records = await requestToPromise(
      transaction.objectStore(HISTORY_STORE_NAME).index("updatedAt").getAll(),
    );
    await transactionToPromise(transaction);
    return records.filter(isHistoryRecordV1).reverse();
  } finally {
    database.close();
  }
};

export const updateHistoryResult = async (
  historyId: string,
  result: GenerationResult,
  now: Date = new Date(),
): Promise<HistoryRecordV1> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const current = await requestToPromise(store.get(historyId));
    if (!isHistoryRecordV1(current)) {
      transaction.abort();
      throw new Error("History record was not found.");
    }
    const updated: HistoryRecordV1 = { ...current, result, updatedAt: now.toISOString() };
    if (!isHistoryRecordV1(updated)) {
      transaction.abort();
      throw new Error("History update failed validation.");
    }
    store.put(updated);
    await transactionToPromise(transaction);
    return updated;
  } finally {
    database.close();
  }
};

export const updateHistoryMedia = async (
  historyId: string,
  media: ImageHistoryMetadata,
  now: Date = new Date(),
): Promise<HistoryRecordV1> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const current = await requestToPromise(store.get(historyId));
    if (!isHistoryRecordV1(current)) {
      transaction.abort();
      throw new Error("History record was not found.");
    }
    const updated: HistoryRecordV1 = {
      ...current,
      media,
      updatedAt: now.toISOString(),
    };
    if (!isHistoryRecordV1(updated)) {
      transaction.abort();
      throw new Error("History media update failed validation.");
    }
    store.put(updated);
    await transactionToPromise(transaction);
    return updated;
  } finally {
    database.close();
  }
};

export const deleteHistoryRecord = async (historyId: string): Promise<void> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    transaction.objectStore(HISTORY_STORE_NAME).delete(historyId);
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
};

export const clearHistoryRecords = async (): Promise<void> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    transaction.objectStore(HISTORY_STORE_NAME).clear();
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
};
