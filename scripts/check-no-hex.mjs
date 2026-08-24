#!/usr/bin/env node
/**
 * Fails if a colour literal appears outside the palette.
 *
 * The three schemes work because components name roles (`bg-surface`,
 * `text-due-fg`) and never colours. One hardcoded `#4c4fe0` in a component is
 * invisible in Daylight and wrong in the other two — the kind of drift that is
 * only noticed after a scheme has quietly broken.
 *
 * Run: node scripts/check-no-hex.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `fileURLToPath`, not `.pathname`.
 *
 * On Windows a `file://` URL's pathname is `/D:/Codes/…` — the leading slash
 * before the drive letter is not a real segment, and joining it to a directory
 * yields `D:\D:\Codes\…`, which does not exist. `fileURLToPath` is the
 * conversion that knows about drive letters.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The two files allowed to hold raw colour.
 *
 * `styles/themes.css` is the palette itself. `lib/theme/themes.ts` carries the
 * swatch values for the scheme picker, which have to stay constant regardless
 * of the active scheme — a Daylight swatch must show Daylight's colours even
 * while Nightlab is applied, so they cannot be read from the live tokens.
 */
const ALLOWED = new Set(["styles/themes.css", "lib/theme/themes.ts"]);

/** Where component code lives. */
const SCAN = ["app", "components", "lib", "styles"];

const EXTENSIONS = [".ts", ".tsx", ".css"];

// 3-, 6- and 8-digit hex. Deliberately not matching #id selectors in CSS
// because those require a leading letter that is not a hex digit boundary —
// in practice a 3/6/8 hex run in these files is always a colour.
const HEX = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}

const offences = [];

for (const dir of SCAN) {
  // Collected eagerly inside the `try`, not lazily: `walk` is a generator, so
  // calling it does nothing and the `readdir` inside it throws during
  // iteration — which, outside this block, no `catch` would ever see.
  const files = [];
  try {
    for (const file of walk(join(ROOT, dir))) files.push(file);
  } catch {
    continue; // Directory not created yet.
  }

  for (const file of files) {
    // Forward slashes whatever the platform: `relative` returns backslashes on
    // Windows, so the allow-list below would never match and the two palette
    // files would be reported as offences against the palette.
    const rel = relative(ROOT, file).split(sep).join("/");
    if (ALLOWED.has(rel)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.match(HEX) ?? []) {
        offences.push(`${rel}:${index + 1}  ${match}`);
      }
    });
  }
}

if (offences.length > 0) {
  console.error(
    `Colour literals outside ${[...ALLOWED].join(" and ")}:\n\n` +
      offences.map((line) => `  ${line}`).join("\n") +
      "\n\nUse a semantic token instead — bg-surface, text-ink, border-line,\n" +
      "bg-accent, text-due-fg, text-danger-fg. Add a token to styles/themes.css\n" +
      "if the role does not exist yet.\n",
  );
  process.exit(1);
}

console.log("No colour literals outside the palette.");
