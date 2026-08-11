import {
  createDefaultPromptLibrary,
  isPromptLibraryV1,
  MAX_PROMPT_INSTRUCTION_LENGTH,
  MAX_PROMPT_NAME_LENGTH,
  type PromptLibraryV1,
  type ResolvedPromptLibrary,
  type ResolvedPromptTemplate,
  resolvePromptLibrary,
} from "../core/prompts/library";
import { BUILT_IN_STYLES, BUILT_IN_STYLE_SEED_VERSION } from "../core/prompts/styles";

export const PROMPT_LIBRARY_STORAGE_KEY = "postmuse.prompts";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

const validateEditableText = (label: string, instruction: string): void => {
  if (!label.trim() || label.length > MAX_PROMPT_NAME_LENGTH) {
    throw new Error("Prompt name failed validation.");
  }
  if (!instruction.trim() || instruction.length > MAX_PROMPT_INSTRUCTION_LENGTH) {
    throw new Error("Prompt instruction failed validation.");
  }
};

export const loadPromptLibrary = async (): Promise<PromptLibraryV1> => {
  if (!canUseLocalStorage()) {
    return createDefaultPromptLibrary();
  }

  const stored = await chrome.storage.local.get(PROMPT_LIBRARY_STORAGE_KEY);
  const current = stored[PROMPT_LIBRARY_STORAGE_KEY];
  if (isPromptLibraryV1(current)) {
    if (current.seedVersion < BUILT_IN_STYLE_SEED_VERSION) {
      return savePromptLibrary(current);
    }
    return current;
  }

  const initial = createDefaultPromptLibrary();
  await chrome.storage.local.set({ [PROMPT_LIBRARY_STORAGE_KEY]: initial });
  return initial;
};

export const savePromptLibrary = async (library: PromptLibraryV1): Promise<PromptLibraryV1> => {
  const next = { ...library, seedVersion: BUILT_IN_STYLE_SEED_VERSION };
  if (!isPromptLibraryV1(next)) {
    throw new Error("Prompt library failed validation.");
  }
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [PROMPT_LIBRARY_STORAGE_KEY]: next });
  }
  return next;
};

export const loadResolvedPromptLibrary = async (): Promise<ResolvedPromptLibrary> =>
  resolvePromptLibrary(await loadPromptLibrary());

export const findActivePrompt = async (
  styleId: string,
): Promise<ResolvedPromptTemplate | undefined> =>
  (await loadResolvedPromptLibrary()).active.find((template) => template.id === styleId);

export const savePromptTemplate = async (
  styleId: string | undefined,
  label: string,
  instruction: string,
): Promise<PromptLibraryV1> => {
  validateEditableText(label, instruction);
  const library = await loadPromptLibrary();
  const builtIn = styleId ? BUILT_IN_STYLES.find((seed) => seed.id === styleId) : undefined;

  if (builtIn) {
    const override = {
      styleId: builtIn.id,
      baseVersion: builtIn.version,
      label: label.trim(),
      instruction: instruction.trim(),
    };
    return savePromptLibrary({
      ...library,
      overrides: [...library.overrides.filter((item) => item.styleId !== builtIn.id), override],
      hiddenBuiltInIds: library.hiddenBuiltInIds.filter((id) => id !== builtIn.id),
    });
  }

  if (styleId) {
    const existing = library.customTemplates.find((template) => template.id === styleId);
    if (!existing) {
      throw new Error("Prompt template was not found.");
    }
    return savePromptLibrary({
      ...library,
      customTemplates: library.customTemplates.map((template) =>
        template.id === styleId
          ? { ...template, label: label.trim(), instruction: instruction.trim() }
          : template,
      ),
    });
  }

  const id = `custom-${crypto.randomUUID()}`;
  return savePromptLibrary({
    ...library,
    customTemplates: [
      ...library.customTemplates,
      { id, version: 1, label: label.trim(), instruction: instruction.trim() },
    ],
    order: [...library.order, id],
  });
};

export const hideBuiltInPrompt = async (styleId: string): Promise<PromptLibraryV1> => {
  if (!BUILT_IN_STYLES.some((seed) => seed.id === styleId)) {
    throw new Error("Built-in prompt was not found.");
  }
  const library = await loadPromptLibrary();
  if (
    resolvePromptLibrary(library).active.filter((template) => template.id !== styleId).length === 0
  ) {
    throw new Error("At least one prompt must remain active.");
  }
  return savePromptLibrary({
    ...library,
    hiddenBuiltInIds: [...new Set([...library.hiddenBuiltInIds, styleId])],
  });
};

export const deleteCustomPrompt = async (styleId: string): Promise<PromptLibraryV1> => {
  const library = await loadPromptLibrary();
  if (!library.customTemplates.some((template) => template.id === styleId)) {
    throw new Error("Custom prompt was not found.");
  }
  if (
    resolvePromptLibrary(library).active.filter((template) => template.id !== styleId).length === 0
  ) {
    throw new Error("At least one prompt must remain active.");
  }
  return savePromptLibrary({
    ...library,
    customTemplates: library.customTemplates.filter((template) => template.id !== styleId),
    order: library.order.filter((id) => id !== styleId),
  });
};

export const restoreBuiltInPrompt = async (styleId: string): Promise<PromptLibraryV1> => {
  if (!BUILT_IN_STYLES.some((seed) => seed.id === styleId)) {
    throw new Error("Built-in prompt was not found.");
  }
  const library = await loadPromptLibrary();
  return savePromptLibrary({
    ...library,
    overrides: library.overrides.filter((override) => override.styleId !== styleId),
    hiddenBuiltInIds: library.hiddenBuiltInIds.filter((id) => id !== styleId),
  });
};

export const restoreAllBuiltInPrompts = async (): Promise<PromptLibraryV1> => {
  const library = await loadPromptLibrary();
  const customIds = library.customTemplates.map((template) => template.id);
  return savePromptLibrary({
    ...library,
    overrides: [],
    hiddenBuiltInIds: [],
    order: [...BUILT_IN_STYLES.map((seed) => seed.id), ...customIds],
  });
};

export const movePrompt = async (
  styleId: string,
  direction: "up" | "down",
): Promise<PromptLibraryV1> => {
  const library = await loadPromptLibrary();
  const resolved = resolvePromptLibrary(library);
  const visibleIds = resolved.active.map((template) => template.id);
  const index = visibleIds.indexOf(styleId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) {
    return library;
  }
  [visibleIds[index], visibleIds[nextIndex]] = [visibleIds[nextIndex], visibleIds[index]];
  return savePromptLibrary({
    ...library,
    order: [...visibleIds, ...resolved.hidden.map((template) => template.id)],
  });
};
