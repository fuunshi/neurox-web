import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves tsconfig `paths` natively now, so the plugin is gone.
    tsconfigPaths: true,
    alias: {
      /**
       * `server-only` is a marker package that *throws* when imported outside a
       * React Server Component — which is the point of it, but it makes any
       * module importing it untestable. Aliasing it to an empty module lets the
       * pure functions inside server modules be tested directly, while the real
       * package still guards the Next build.
       */
      "server-only": new URL("./test/empty-module.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
