import type { ReactNode, SVGProps } from "react";

export type InlineIconName =
  | "arrows-clockwise"
  | "copy"
  | "gear"
  | "globe"
  | "sidebar"
  | "sparkle"
  | "stop"
  | "warning"
  | "x";

interface InlineIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: InlineIconName;
  size?: number;
}

export function InlineIcon({ name, size = 18, ...props }: InlineIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };
  let drawing: ReactNode;
  switch (name) {
    case "sparkle":
      drawing = (
        <>
          <path
            d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z"
            fill="currentColor"
          />
          <path
            d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"
            fill="currentColor"
          />
        </>
      );
      break;
    case "globe":
      drawing = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.2 5.4 3.2 9s-1 6.6-3.2 9c-2.2-2.4-3.2-5.4-3.2-9S9.8 5.4 12 3Z" />
        </>
      );
      break;
    case "arrows-clockwise":
      drawing = <path d="M20 7V3l-2.2 2.2A8 8 0 0 0 5 8m-1 9v4l2.2-2.2A8 8 0 0 0 19 16" />;
      break;
    case "copy":
      drawing = (
        <>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      );
      break;
    case "gear":
      drawing = (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6" />
        </>
      );
      break;
    case "sidebar":
      drawing = (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </>
      );
      break;
    case "stop":
      drawing = (
        <>
          <circle cx="12" cy="12" r="9" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "warning":
      drawing = (
        <>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v5m0 3v.1" />
        </>
      );
      break;
    case "x":
      drawing = <path d="m6 6 12 12M18 6 6 18" />;
      break;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...common}
      {...props}
    >
      {drawing}
    </svg>
  );
}
