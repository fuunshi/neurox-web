import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import { themeScript } from "@/lib/theme/script";
import { DEFAULT_THEME } from "@/lib/theme/themes";
import "./globals.css";

/*
 * Newsreader carries the editorial voice (headlines, card faces, source
 * excerpts); Public Sans carries the interface. Both are self-hosted by
 * next/font at build time, so there is no render-blocking request to Google and
 * no layout shift.
 */
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "neurox — turn your study material into flashcards",
    template: "%s — neurox",
  },
  description:
    "Bring your own notes, PDFs and slides. neurox drafts flashcards from them, you review and keep the ones worth remembering.",
};

// No static `themeColor` here on purpose: it would be correct in exactly one of
// the three schemes. The pre-paint script sets `<meta name="theme-color">` from
// the active scheme, and `setTheme` keeps it in step afterwards.

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      // The pre-paint script rewrites this attribute before React hydrates.
      suppressHydrationWarning
      className={`${publicSans.variable} ${newsreader.variable}`}
    >
      <head>
        {/* Must stay inline and unbundled: it has to run before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink">{children}</body>
    </html>
  );
}
