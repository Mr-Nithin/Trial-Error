export function ArcMark({ width = 28, color = "#0B6B57" }: { width?: number; color?: string }) {
  return (
    <svg width={width} height={(width * 42) / 52} viewBox="0 0 52 42" fill="none" aria-hidden="true">
      <path d="M4 36 C 20 36 32 6 48 6" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="4" cy="36" r="4.5" fill={color} />
      <circle cx="26" cy="21" r="3" fill={color} opacity="0.42" />
      <circle cx="48" cy="6" r="4.5" fill={color} />
    </svg>
  );
}

export function ArcLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 10 }} aria-label="arc">
      <ArcMark width={size * 1.3} />
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: size,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        arc
      </span>
    </span>
  );
}
