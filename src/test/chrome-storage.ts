import { vi } from "vitest";

export interface StorageAreaMock {
  data: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  setAccessLevel: ReturnType<typeof vi.fn>;
}

export const createStorageAreaMock = (initial: Record<string, unknown> = {}): StorageAreaMock => {
  const area: StorageAreaMock = {
    data: { ...initial },
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    setAccessLevel: vi.fn(),
  };

  area.get.mockImplementation(async (keys?: string | string[]) => {
    if (typeof keys === "string") {
      return keys in area.data ? { [keys]: area.data[keys] } : {};
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(
        keys.filter((key) => key in area.data).map((key) => [key, area.data[key]]),
      );
    }

    return { ...area.data };
  });
  area.set.mockImplementation(async (values: Record<string, unknown>) => {
    Object.assign(area.data, values);
  });
  area.remove.mockImplementation(async (keys: string | string[]) => {
    for (const key of typeof keys === "string" ? [keys] : keys) {
      delete area.data[key];
    }
  });
  area.setAccessLevel.mockResolvedValue(undefined);

  return area;
};
