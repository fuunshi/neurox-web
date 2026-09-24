import {
  DEFAULT_THEME,
  isDarkTheme,
  isThemeId,
  THEME_COOKIE,
  type ThemeId,
} from "./themes";

/**
 * The active scheme already lives outside React: the pre-paint script sets
 * `data-theme` on `<html>`, and CSS does the rest. So React is not the source
 * of truth here and must not pretend to be — it subscribes to the attribute
 * with `useSyncExternalStore`, which is what that hook is for.
 *
 * The alternative (copying the attribute into state from an effect) both
 * cascades a render on mount and can disagree with what is already painted.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ThemeId {
  const current = document.documentElement.getAttribute("data-theme");
  return isThemeId(current) ? current : DEFAULT_THEME;
}

/** Server render has no DOM, so it reports the same default the markup ships
 *  with. React reconciles to `getSnapshot` after hydration. */
export function getServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function setTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = isDarkTheme(theme) ? "dark" : "light";

  // A year: the reader's choice is not session state.
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
  try {
    localStorage.setItem(THEME_COOKIE, theme);
  } catch {
    // Private mode or storage disabled. The cookie above is the real store.
  }

  // A separate event, because other tabs hold their own listener set.
  emit();
}
