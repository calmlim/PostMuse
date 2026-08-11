export const BUILT_IN_STYLES = [
  {
    id: "professional",
    label: "Professional",
    instruction: "Write with clarity, credibility, restraint, and concrete language.",
  },
  {
    id: "concise",
    label: "Concise",
    instruction: "Remove filler and make every sentence carry one useful point.",
  },
  {
    id: "friendly",
    label: "Friendly",
    instruction: "Sound natural, warm, approachable, and easy to engage with.",
  },
  {
    id: "humorous",
    label: "Humorous",
    instruction: "Use light, clever humor without insulting people or forcing jokes.",
  },
  {
    id: "sharp",
    label: "Sharp",
    instruction: "Take a clear position with tension and precision, without personal attacks.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    instruction: "Use a concrete scene, tension, and an earned insight.",
  },
  {
    id: "educational",
    label: "Educational",
    instruction: "Explain the idea accurately with an orderly, easy-to-follow structure.",
  },
  {
    id: "thought-leadership",
    label: "Thought Leadership",
    instruction: "Offer an original judgment, useful industry context, and a defensible takeaway.",
  },
  {
    id: "product-launch",
    label: "Product Launch",
    instruction:
      "Lead with user value, show differentiation, and end with a grounded call to action.",
  },
  {
    id: "personal-reflection",
    label: "Personal Reflection",
    instruction: "Use a candid first-person voice with specific details and a genuine realization.",
  },
] as const;

export type StyleId = (typeof BUILT_IN_STYLES)[number]["id"];

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === "string" && BUILT_IN_STYLES.some((style) => style.id === value);

export const getBuiltInStyle = (styleId: string) =>
  BUILT_IN_STYLES.find((style) => style.id === styleId);
