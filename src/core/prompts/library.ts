import { isRecordValue } from "../settings/validation";
import {
  BUILT_IN_STYLES,
  BUILT_IN_STYLE_SEED_VERSION,
  type BuiltInStyleSeed,
  isStyleId,
} from "./styles";

export const PROMPT_LIBRARY_SCHEMA_VERSION = 1;
export const MAX_PROMPT_NAME_LENGTH = 80;
export const MAX_PROMPT_INSTRUCTION_LENGTH = 4_000;

export interface PromptOverride {
  styleId: string;
  baseVersion: number;
  label: string;
  instruction: string;
}

export interface CustomPromptTemplate {
  id: string;
  version: 1;
  label: string;
  instruction: string;
}

export interface PromptLibraryV1 {
  schemaVersion: 1;
  seedVersion: number;
  overrides: PromptOverride[];
  hiddenBuiltInIds: string[];
  customTemplates: CustomPromptTemplate[];
  order: string[];
}

export interface ResolvedPromptTemplate {
  id: string;
  version: number;
  label: string;
  instruction: string;
  source: "built-in" | "custom";
  isOverridden: boolean;
  isHidden: boolean;
}

export interface ResolvedPromptLibrary {
  active: ResolvedPromptTemplate[];
  hidden: ResolvedPromptTemplate[];
}

const isValidPromptText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

const isPromptOverride = (value: unknown): value is PromptOverride =>
  isRecordValue(value) &&
  isStyleId(value.styleId) &&
  typeof value.baseVersion === "number" &&
  Number.isInteger(value.baseVersion) &&
  value.baseVersion >= 1 &&
  isValidPromptText(value.label, MAX_PROMPT_NAME_LENGTH) &&
  isValidPromptText(value.instruction, MAX_PROMPT_INSTRUCTION_LENGTH);

const isCustomPromptTemplate = (value: unknown): value is CustomPromptTemplate =>
  isRecordValue(value) &&
  isStyleId(value.id) &&
  value.id.startsWith("custom-") &&
  value.version === 1 &&
  isValidPromptText(value.label, MAX_PROMPT_NAME_LENGTH) &&
  isValidPromptText(value.instruction, MAX_PROMPT_INSTRUCTION_LENGTH);

export const createDefaultPromptLibrary = (): PromptLibraryV1 => ({
  schemaVersion: PROMPT_LIBRARY_SCHEMA_VERSION,
  seedVersion: BUILT_IN_STYLE_SEED_VERSION,
  overrides: [],
  hiddenBuiltInIds: [],
  customTemplates: [],
  order: BUILT_IN_STYLES.map((style) => style.id),
});

export const isPromptLibraryV1 = (value: unknown): value is PromptLibraryV1 => {
  if (
    !isRecordValue(value) ||
    value.schemaVersion !== PROMPT_LIBRARY_SCHEMA_VERSION ||
    typeof value.seedVersion !== "number" ||
    !Number.isInteger(value.seedVersion) ||
    value.seedVersion < 1 ||
    !Array.isArray(value.overrides) ||
    !value.overrides.every(isPromptOverride) ||
    !Array.isArray(value.hiddenBuiltInIds) ||
    !value.hiddenBuiltInIds.every(isStyleId) ||
    !Array.isArray(value.customTemplates) ||
    !value.customTemplates.every(isCustomPromptTemplate) ||
    !Array.isArray(value.order) ||
    !value.order.every(isStyleId)
  ) {
    return false;
  }

  const overrideIds = value.overrides.map((override) => override.styleId);
  const hiddenIds = value.hiddenBuiltInIds;
  const customIds = value.customTemplates.map((template) => template.id);
  const hasActiveTemplate =
    value.customTemplates.length > 0 ||
    BUILT_IN_STYLES.some((seed) => !hiddenIds.includes(seed.id));

  return (
    new Set(overrideIds).size === overrideIds.length &&
    new Set(hiddenIds).size === hiddenIds.length &&
    new Set(customIds).size === customIds.length &&
    hasActiveTemplate
  );
};

const uniqueKnownIds = (ids: string[], knownIds: Set<string>): string[] => {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (!knownIds.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

export const resolvePromptLibrary = (
  library: PromptLibraryV1,
  seeds: readonly BuiltInStyleSeed[] = BUILT_IN_STYLES,
): ResolvedPromptLibrary => {
  const seedIds = new Set(seeds.map((seed) => seed.id));
  const overrides = new Map(
    library.overrides
      .filter((override) => seedIds.has(override.styleId))
      .map((override) => [override.styleId, override]),
  );
  const hiddenIds = new Set(library.hiddenBuiltInIds.filter((id) => seedIds.has(id)));
  const builtIns: ResolvedPromptTemplate[] = seeds.map((seed) => {
    const override = overrides.get(seed.id);
    return {
      id: seed.id,
      version: seed.version,
      label: override?.label ?? seed.label,
      instruction: override?.instruction ?? seed.instruction,
      source: "built-in",
      isOverridden: override !== undefined,
      isHidden: hiddenIds.has(seed.id),
    };
  });
  const custom: ResolvedPromptTemplate[] = library.customTemplates.map((template) => ({
    ...template,
    source: "custom",
    isOverridden: false,
    isHidden: false,
  }));
  const byId = new Map([...builtIns, ...custom].map((template) => [template.id, template]));
  const knownIds = new Set(byId.keys());
  const orderedIds = uniqueKnownIds(library.order, knownIds);
  for (const id of knownIds) {
    if (!orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as ResolvedPromptTemplate[];

  return {
    active: ordered.filter((template) => !template.isHidden),
    hidden: ordered.filter((template) => template.isHidden),
  };
};
