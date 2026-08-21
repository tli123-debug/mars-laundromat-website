import { describe, expect, it } from "vitest";
import { bookingMapsHref, bookingPhoneHref, bookingSmsHref } from "./booking-links";

describe("bookingPhoneHref", () => {
  it("strips formatting characters and prepends tel:", () => {
    expect(bookingPhoneHref("(718) 555-0134")).toBe("tel:7185550134");
  });

  it("handles an already-plain number", () => {
    expect(bookingPhoneHref("7185550134")).toBe("tel:7185550134");
  });

  it("strips a leading +1 country code digit along with everything else", () => {
    expect(bookingPhoneHref("+1 (718) 555-0134")).toBe("tel:17185550134");
  });
});

describe("bookingSmsHref", () => {
  it("strips formatting characters and prepends sms:, with no message body", () => {
    expect(bookingSmsHref("(718) 555-0134")).toBe("sms:7185550134");
  });
});

describe("bookingMapsHref", () => {
  it("appends the neighborhood/city/state when the address doesn't mention Brooklyn", () => {
    const href = bookingMapsHref("123 7th Ave, Apt 4B");
    expect(href).toContain(encodeURIComponent("123 7th Ave, Apt 4B, Park Slope, Brooklyn"));
  });

  it("does not duplicate the suffix when the address already says Brooklyn", () => {
    const href = bookingMapsHref("123 7th Ave, Brooklyn, NY 11215");
    const decoded = decodeURIComponent(href.split("query=")[1]);
    expect(decoded).toBe("123 7th Ave, Brooklyn, NY 11215");
    expect(decoded).not.toContain("Park Slope, Brooklyn, Park Slope, Brooklyn");
  });

  it("the Brooklyn check is case-insensitive", () => {
    const href = bookingMapsHref("123 7th Ave, brooklyn, ny");
    const decoded = decodeURIComponent(href.split("query=")[1]);
    expect(decoded).toBe("123 7th Ave, brooklyn, ny");
  });

  it("uses the keyless Google Maps search endpoint", () => {
    const href = bookingMapsHref("123 7th Ave");
    expect(href.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
  });

  it("properly URL-encodes special characters in the address", () => {
    const href = bookingMapsHref("123 7th Ave, Apt #4B & Unit C");
    const decoded = decodeURIComponent(href.split("query=")[1]);
    expect(decoded).toContain("#4B & Unit C");
  });
});
