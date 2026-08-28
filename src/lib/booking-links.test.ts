import { describe, expect, it } from "vitest";
import {
  bookingMapsHref,
  bookingPhoneHref,
  bookingQuoteTextHref,
  bookingSmsHref,
  buildQuoteTextMessage,
} from "./booking-links";

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

  it("appends a URL-encoded body when provided", () => {
    const href = bookingSmsHref("(718) 555-0134", "Hi there! Total: $48.");
    expect(href).toBe(`sms:7185550134?body=${encodeURIComponent("Hi there! Total: $48.")}`);
  });

  it("properly encodes spaces, punctuation, and the dollar sign in the body", () => {
    const href = bookingSmsHref("7185550134", "A & B, $10 total?");
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe("A & B, $10 total?");
  });
});

describe("buildQuoteTextMessage", () => {
  it("matches the exact owner-approved wording, with no Zelle detail (owner hasn't provided one yet)", () => {
    const message = buildQuoteTextMessage("Jane Rivera", 4800);
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat. Your order total is $48. Cash or Zelle accepted. You can pay cash at the door when we deliver. Please reply if you have any questions."
    );
  });

  it("formats a whole-dollar total with no cents, matching the site-wide currency style", () => {
    expect(buildQuoteTextMessage("Jane", 3000)).toContain("Your order total is $30.");
  });

  it("formats a fractional total with cents", () => {
    expect(buildQuoteTextMessage("Jane", 4850)).toContain("Your order total is $48.50.");
  });

  it("uses the customer's real name in place of a placeholder", () => {
    expect(buildQuoteTextMessage("Wei Chen", 4800)).toMatch(/^Hi Wei Chen,/);
  });
});

describe("bookingQuoteTextHref", () => {
  it("combines the phone and message into one properly-encoded sms: link", () => {
    const href = bookingQuoteTextHref("(718) 555-0134", "Jane Rivera", 4800);
    expect(href.startsWith("sms:7185550134?body=")).toBe(true);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe(buildQuoteTextMessage("Jane Rivera", 4800));
  });

  it("round-trips through encode/decode without corrupting the dollar sign or punctuation", () => {
    const href = bookingQuoteTextHref("7185550134", "Jane Rivera", 4800);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("$48.");
    expect(decoded).toContain("Please reply if you have any questions.");
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
