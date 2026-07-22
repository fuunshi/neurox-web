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
    /** Swatch values for the picker. Kept here so the picker never parses CSS. */
    swatch: { bg: "#fafafb", accent: "#4c4fe0", ink: "#14161f" },
  },
  {
    id: "nightlab",
    label: "Nightlab",
    hint: "Dark, for late sessions",
    swatch: { bg: "#0c0d12", accent: "#8b8cff", ink: "#eceaf4" },
  },
  {
    id: "paper",
    label: "Paper",
    hint: "Warm and low-glare",
    swatch: { bg: "#f7f4ee", accent: "#3f45c9", ink: "#1c1a16" },
  },
] as const;

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
