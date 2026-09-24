import { DEFAULT_THEME, THEMES, THEME_COOKIE } from "./themes";

/**
 * Runs before the first paint, inline in `<head>`.
 *
 * Reading the theme server-side would mean `await cookies()` in the root
 * layout, which opts every route — including the marketing pages — out of
 * static rendering. This script buys the same result (no flash of the wrong
 * scheme) for ~400 bytes and keeps `/` statically generated.
 *
 * The cookie is the source of truth because it is the only store the server
 * could read later if that trade-off ever changes; localStorage is a mirror so
 * that clearing cookies does not reset the reader's choice.
 *
 * Built from `themes.ts` rather than hardcoded, so adding a scheme cannot leave
 * the script accepting an id the CSS does not define, or missing a chrome
 * colour.
 *
 * The one piece of logic that is necessarily duplicated is applying
 * `theme-color` to `<meta>`: `lib/theme/store.ts` does the same for later
 * switches. This script has to be self-contained and inline, so it cannot
 * import that function.
 */

const VALID_IDS = JSON.stringify(THEMES.map((theme) => theme.id));

const BG_BY_ID = JSON.stringify(
  Object.fromEntries(THEMES.map((theme) => [theme.id, theme.palette.bg])),
);

export const themeScript = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/);
var t=m?decodeURIComponent(m[1]):null;
if(!t){try{t=localStorage.getItem("${THEME_COOKIE}")}catch(e){}}
if(${VALID_IDS}.indexOf(t)===-1){t="${DEFAULT_THEME}"}
var d=document.documentElement;
d.setAttribute("data-theme",t);
d.style.colorScheme=t==="nightlab"?"dark":"light";
var b=${BG_BY_ID};
var c=document.querySelector('meta[name="theme-color"]');
if(!c){c=document.createElement("meta");c.setAttribute("name","theme-color");document.head.appendChild(c)}
c.setAttribute("content",b[t]||b["${DEFAULT_THEME}"]);
}catch(e){}})();`;
