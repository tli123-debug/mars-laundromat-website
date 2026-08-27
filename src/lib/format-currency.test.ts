import { describe, expect, it } from "vitest";
import { formatDollars } from "./format-currency";

describe("formatDollars", () => {
  it("formats a whole-dollar amount with no decimals", () => {
    expect(formatDollars(3000)).toBe("$30");
    expect(formatDollars(1000)).toBe("$10");
  });

  it("formats an amount with cents, keeping the decimals", () => {
    expect(formatDollars(150)).toBe("$1.50");
  });

  it("formats zero as a whole dollar amount", () => {
    expect(formatDollars(0)).toBe("$0");
  });
});
