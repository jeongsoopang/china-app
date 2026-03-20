export const colors = {
  background: "#edf3fb",
  surface: "rgba(255,255,255,0.92)",
  surfaceMuted: "rgba(248,252,255,0.88)",
  surfaceAccent: "rgba(236,244,255,0.90)",
  border: "rgba(176,196,220,0.44)",
  borderStrong: "rgba(134,160,193,0.58)",
  textPrimary: "#0f1f36",
  textSecondary: "#51627a",
  textMuted: "#74859b",
  accent: "#132f5b",
  accentSoft: "#ecf2ff",
  success: "#166534",
  successSoft: "#eaf8ee",
  warning: "#92400e",
  warningSoft: "#fff7ed",
  error: "#b91c1c"
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999
} as const;

export const typography = {
  hero: 34,
  titleLarge: 30,
  title: 26,
  subtitle: 19,
  body: 15,
  bodySmall: 13,
  caption: 12
} as const;
