/**
 * The three schemes, as data.
 *
 * `id` is what lands in `data-theme` and in the cookie, so it must stay stable —
 * it is the contract between the CSS in `styles/themes.css`, the pre-paint
 * script, and anything already stored in a reader's browser.
 */
export const THEMES = [
  {
    id: "daylight",
    label: "Daylight",
    hint: "Cool and bright",
    /**
     * Must mirror the corresponding block in `styles/themes.css`.
     *
     * These are data because they have to stay constant regardless of which
     * scheme is active — the picker shows a Daylight swatch while Nightlab is
     * applied, so it cannot read the live tokens. `bg` also feeds the browser
     * chrome colour, which is per-scheme for the same reason.
     */
    palette: { bg: "#fafafb", accent: "#4c4fe0", ink: "#14161f" },
  },
  {
    id: "nightlab",
    label: "Nightlab",
    hint: "Dark, for late sessions",
    palette: { bg: "#0c0d12", accent: "#8b8cff", ink: "#eceaf4" },
  },
  {
    id: "paper",
    label: "Paper",
    hint: "Warm and low-glare",
    palette: { bg: "#f7f4ee", accent: "#3f45c9", ink: "#1c1a16" },
  },
] as const;

/** The page background of a scheme, for `<meta name="theme-color">`. */
export function themeColor(id: ThemeId): string {
  return (
    THEMES.find((theme) => theme.id === id)?.palette.bg ?? THEMES[0].palette.bg
  );
}

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "daylight";

export const THEME_COOKIE = "nx_theme";

const THEME_IDS = THEMES.map((theme) => theme.id) as readonly string[];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value);
}

/** Schemes with a dark ground, for `color-scheme` and for anything that must
 *  know whether it is sitting on dark. Derived from the palette rather than
 *  hand-listed so it cannot drift. */
const DARK_THEMES: readonly ThemeId[] = ["nightlab"];

export function isDarkTheme(theme: ThemeId): boolean {
  return DARK_THEMES.includes(theme);
}
