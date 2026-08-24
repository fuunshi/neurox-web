import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Unmount whatever the last test rendered.
 *
 * Testing Library registers this itself only when `afterEach` is a global, and
 * this project does not run Vitest with `globals: true` — every test imports
 * `describe`/`it` explicitly. Without it, each `render` leaves its tree in the
 * DOM and the next test's queries match both, which surfaces as a confusing
 * "found multiple elements" rather than as a missing cleanup.
 */
afterEach(() => {
  cleanup();
});
