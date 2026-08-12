interface BrandMarkProps {
  className?: string;
  size?: number;
}

export function BrandMark({ className, size = 28 }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={size}
      viewBox="0 0 128 128"
      width={size}
    >
      <rect width="128" height="128" rx="26" fill="#315FD0" />
      <path
        d="M64 16c-3.5 14.5-10.4 24-23.5 29 9.3 2.4 13.5 8.5 9 17H36l25 50h6l25-50H78.5c-4.5-8.5-.3-14.6 9-17C74.4 40 67.5 30.5 64 16Z"
        fill="#F7F5F0"
      />
      <path
        d="M64 27c2.3 9.7 7.8 15.3 17.5 18-9.7 2.7-15.2 8.3-17.5 18-2.3-9.7-7.8-15.3-17.5-18 9.7-2.7 15.2-8.3 17.5-18Z"
        fill="#EE763B"
      />
      <circle cx="64" cy="72" r="6" fill="#315FD0" />
      <path d="M64 76v35" stroke="#315FD0" strokeWidth="5" />
    </svg>
  );
}
