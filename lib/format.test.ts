import { describe, expect, it } from "vitest";
import { formatPercent } from "./format";

describe("formatPercent", () => {
  it("renders a rate as a whole percentage", () => {
    expect(formatPercent(0.636)).toBe("64%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("renders null as an em dash, not as zero", () => {
    // The API sends null for "nothing asked yet". Showing 0% would turn "you
    // have not tried this" into "you got every one wrong".
    expect(formatPercent(null)).toBe("—");
  });

  it("refuses to print NaN or Infinity at a reader", () => {
    expect(formatPercent(Number.NaN)).toBe("—");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
