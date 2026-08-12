import { mkdir, readFile, writeFile } from "node:fs/promises";

const locales = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "es", "pt-BR", "fr", "de"];
const keys = [
  "appName",
  "copyFailed",
  "copyText",
  "inlineActionLabel",
  "inlineActionQuote",
  "inlineActionReply",
  "inlineActionRewrite",
  "inlineCancel",
  "inlineClose",
  "inlineContextDisclosure",
  "inlineCopied",
  "inlineExtractionError",
  "inlineGenerate",
  "inlineGenerating",
  "inlineHistorySyncWarning",
  "inlineIncludeContext",
  "inlineOpenError",
  "inlineOpenSidePanel",
  "inlinePermissionError",
  "inlineResultLabel",
  "inlineRuntimeError",
  "inlineSetupBody",
  "inlineSetupTitle",
  "inlineTitle",
  "inlineTrigger",
  "languageFollowSource",
  "outputLanguageLabel",
  "regenerateItem",
  "styleConcise",
  "styleEducational",
  "styleFriendly",
  "styleHumorous",
  "styleLabel",
  "stylePersonalReflection",
  "styleProductLaunch",
  "styleProfessional",
  "styleSharp",
  "styleStorytelling",
  "styleThoughtLeadership",
];

await mkdir("src/i18n/inline", { recursive: true });
for (const locale of locales) {
  const full = JSON.parse(await readFile(`src/i18n/${locale}.json`, "utf8"));
  const missing = keys.filter((key) => typeof full[key] !== "string");
  if (missing.length) {
    throw new Error(`${locale} is missing inline keys: ${missing.join(", ")}`);
  }
  const catalog = Object.fromEntries(keys.map((key) => [key, full[key]]));
  await writeFile(`src/i18n/inline/${locale}.json`, `${JSON.stringify(catalog, null, 2)}\n`);
}
