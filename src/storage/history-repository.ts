import type { GenerationInput, GenerationResult } from "../core/generation/types";
import { imageResultToBytes } from "../core/image/blob";
import type {
  ImageGenerationInput,
  ImageGenerationResult,
  ImageHistoryMetadata,
} from "../core/image/types";
import {
  HISTORY_LIMIT,
  HISTORY_SCHEMA_VERSION,
  type HistoryRecord,
  type HistoryRecordV1,
  type ImageHistoryRecordV2,
  isHistoryRecord,
  isHistoryRecordV1,
  isImageHistoryRecordV2,
} from "../core/history/types";

export const HISTORY_DATABASE_NAME = "postmuse";
export const HISTORY_DATABASE_VERSION = 2;
export const HISTORY_STORE_NAME = "history";
export const HISTORY_IMAGE_STORE_NAME = "history-images";
export const HISTORY_BYTE_LIMIT = 10 * 1024 * 1024;
export const HISTORY_IMAGE_BYTE_LIMIT = 100 * 1024 * 1024;
export const MAX_HISTORY_IMAGE_BYTES = 25 * 1024 * 1024;

interface StoredHistoryImage {
  historyId: string;
  bytes: Uint8Array;
  mimeType: ImageGenerationResult["mimeType"];
}

const getStoredByteLength = (value: unknown): number | undefined =>
  ArrayBuffer.isView(value) ? value.byteLength : undefined;

const getRecordByteLength = (record: HistoryRecord): number =>
  new TextEncoder().encode(JSON.stringify(record)).byteLength;

interface HistoryRetentionLimits {
  recordCount: number;
  recordBytes: number;
  imageBytes: number;
}

export const selectRetainedHistoryIds = (
  recordsOldestFirst: HistoryRecord[],
  imageSizes: ReadonlyMap<string, number>,
  limits: HistoryRetentionLimits = {
    recordCount: HISTORY_LIMIT,
    recordBytes: HISTORY_BYTE_LIMIT,
    imageBytes: HISTORY_IMAGE_BYTE_LIMIT,
  },
): Set<string> => {
  const retained = new Set<string>();
  let retainedRecordBytes = 0;
  let retainedImageBytes = 0;
  for (let index = recordsOldestFirst.length - 1; index >= 0; index -= 1) {
    const current = recordsOldestFirst[index];
    const recordBytes = getRecordByteLength(current);
    const imageBytes = imageSizes.get(current.id) ?? 0;
    if (
      retained.size < limits.recordCount &&
      retainedRecordBytes + recordBytes <= limits.recordBytes &&
      retainedImageBytes + imageBytes <= limits.imageBytes
    ) {
      retained.add(current.id);
      retainedRecordBytes += recordBytes;
      retainedImageBytes += imageBytes;
    }
  }
  return retained;
};

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
      if (!database.objectStoreNames.contains(HISTORY_IMAGE_STORE_NAME)) {
        database.createObjectStore(HISTORY_IMAGE_STORE_NAME, { keyPath: "historyId" });
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

const createImageMetadata = (
  result: ImageGenerationResult,
  generatedAt: string,
  input?: ImageGenerationInput,
): ImageHistoryMetadata => ({
  type: "image",
  provider: result.provider,
  model: result.model,
  prompt: result.prompt,
  aspectRatio: result.aspectRatio,
  size: result.size,
  mimeType: result.mimeType,
  pixelWidth: result.pixelWidth,
  pixelHeight: result.pixelHeight,
  generatedAt,
  ...(input ? { input } : {}),
});

const pruneHistory = async (transaction: IDBTransaction): Promise<void> => {
  const historyStore = transaction.objectStore(HISTORY_STORE_NAME);
  const imageStore = transaction.objectStore(HISTORY_IMAGE_STORE_NAME);
  const recordsRequest = historyStore.index("updatedAt").getAll();
  const imagesRequest = imageStore.getAll();
  const [storedRecords, storedImages] = await Promise.all([
    requestToPromise(recordsRequest),
    requestToPromise(imagesRequest),
  ]);
  const records = storedRecords.filter(isHistoryRecord);
  const recordIds = new Set(records.map((record) => record.id));
  const imageSizes = new Map(
    (storedImages as StoredHistoryImage[])
      .filter(
        (image) =>
          typeof image?.historyId === "string" && getStoredByteLength(image.bytes) !== undefined,
      )
      .map((image) => [image.historyId, getStoredByteLength(image.bytes) ?? 0]),
  );
  const retainedIds = selectRetainedHistoryIds(records, imageSizes);

  for (const image of storedImages as StoredHistoryImage[]) {
    if (typeof image?.historyId === "string" && !recordIds.has(image.historyId)) {
      imageStore.delete(image.historyId);
    }
  }

  for (const current of records) {
    if (!retainedIds.has(current.id)) {
      historyStore.delete(current.id);
      imageStore.delete(current.id);
    }
  }
};

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
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readwrite",
    );
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    await requestToPromise(store.put(record));
    await pruneHistory(transaction);
    await transactionToPromise(transaction);
    return record;
  } finally {
    database.close();
  }
};

export const saveImageHistoryRecord = async (
  input: ImageGenerationInput,
  result: ImageGenerationResult,
  now: Date = new Date(),
): Promise<ImageHistoryRecordV2> => {
  const timestamp = now.toISOString();
  const record: ImageHistoryRecordV2 = {
    schemaVersion: 2,
    kind: "image",
    id: createHistoryId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    input,
    result: createImageMetadata(result, timestamp),
  };
  if (!isImageHistoryRecordV2(record)) {
    throw new Error("Image history record failed validation.");
  }
  const bytes = imageResultToBytes(result);
  if (bytes.byteLength > MAX_HISTORY_IMAGE_BYTES) {
    throw new Error("Generated image is too large for local history.");
  }

  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readwrite",
    );
    await Promise.all([
      requestToPromise(transaction.objectStore(HISTORY_STORE_NAME).put(record)),
      requestToPromise(
        transaction.objectStore(HISTORY_IMAGE_STORE_NAME).put({
          historyId: record.id,
          bytes,
          mimeType: result.mimeType,
        }),
      ),
    ]);
    await pruneHistory(transaction);
    await transactionToPromise(transaction);
    return record;
  } finally {
    database.close();
  }
};

export const listHistoryRecords = async (): Promise<HistoryRecord[]> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readonly");
    const records = await requestToPromise(
      transaction.objectStore(HISTORY_STORE_NAME).index("updatedAt").getAll(),
    );
    await transactionToPromise(transaction);
    return records.filter(isHistoryRecord).reverse();
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
  input: ImageGenerationInput,
  result: ImageGenerationResult,
  now: Date = new Date(),
): Promise<HistoryRecordV1> => {
  const bytes = imageResultToBytes(result);
  if (bytes.byteLength > MAX_HISTORY_IMAGE_BYTES) {
    throw new Error("Generated image is too large for local history.");
  }
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readwrite",
    );
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const current = await requestToPromise(store.get(historyId));
    if (!isHistoryRecordV1(current)) {
      transaction.abort();
      throw new Error("History record was not found.");
    }
    const updated: HistoryRecordV1 = {
      ...current,
      media: createImageMetadata(result, now.toISOString(), input),
      updatedAt: now.toISOString(),
    };
    if (!isHistoryRecordV1(updated)) {
      transaction.abort();
      throw new Error("History media update failed validation.");
    }
    store.put(updated);
    transaction.objectStore(HISTORY_IMAGE_STORE_NAME).put({
      historyId,
      bytes,
      mimeType: result.mimeType,
    });
    await pruneHistory(transaction);
    await transactionToPromise(transaction);
    return updated;
  } finally {
    database.close();
  }
};

export interface HistoryStorageSummary {
  recordCount: number;
  imageBytes: number;
}

export const getHistoryStorageSummary = async (): Promise<HistoryStorageSummary> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readonly",
    );
    const [records, images] = await Promise.all([
      requestToPromise(transaction.objectStore(HISTORY_STORE_NAME).getAll()),
      requestToPromise(transaction.objectStore(HISTORY_IMAGE_STORE_NAME).getAll()),
    ]);
    await transactionToPromise(transaction);
    return {
      recordCount: records.filter(isHistoryRecord).length,
      imageBytes: (images as StoredHistoryImage[]).reduce(
        (total, image) => total + (getStoredByteLength(image?.bytes) ?? 0),
        0,
      ),
    };
  } finally {
    database.close();
  }
};

export const loadHistoryImageBlob = async (historyId: string): Promise<Blob | undefined> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(HISTORY_IMAGE_STORE_NAME, "readonly");
    const stored = (await requestToPromise(
      transaction.objectStore(HISTORY_IMAGE_STORE_NAME).get(historyId),
    )) as StoredHistoryImage | undefined;
    await transactionToPromise(transaction);
    if (!stored || !ArrayBuffer.isView(stored.bytes) || typeof stored.mimeType !== "string") {
      return undefined;
    }
    const bytes = new Uint8Array(stored.bytes.byteLength);
    bytes.set(
      new Uint8Array(stored.bytes.buffer, stored.bytes.byteOffset, stored.bytes.byteLength),
    );
    return new Blob([bytes.buffer], { type: stored.mimeType });
  } finally {
    database.close();
  }
};

export const deleteHistoryRecord = async (historyId: string): Promise<void> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readwrite",
    );
    transaction.objectStore(HISTORY_STORE_NAME).delete(historyId);
    transaction.objectStore(HISTORY_IMAGE_STORE_NAME).delete(historyId);
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
};

export const clearHistoryRecords = async (): Promise<void> => {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(
      [HISTORY_STORE_NAME, HISTORY_IMAGE_STORE_NAME],
      "readwrite",
    );
    transaction.objectStore(HISTORY_STORE_NAME).clear();
    transaction.objectStore(HISTORY_IMAGE_STORE_NAME).clear();
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
};
