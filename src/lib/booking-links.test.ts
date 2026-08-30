import { describe, expect, it } from "vitest";
import {
  bookingMapsHref,
  bookingPhoneHref,
  bookingPickupConfirmationTextHref,
  bookingQuoteTextHref,
  bookingSmsHref,
  buildPickupConfirmationMessage,
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
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Your order total is $48.\n\n" +
        "Cash or Zelle accepted. You can pay cash at the door when we deliver.\n\n" +
        "Please reply if you have any questions."
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

  it("never includes Zelle recipient details while ZELLE_RECIPIENT_DETAIL stays null, only the fixed 'accepted' wording", () => {
    const message = buildQuoteTextMessage("Jane", 4800);
    expect(message).toContain("Cash or Zelle accepted.");
    expect(message).not.toContain("(Zelle:");
  });

  it("includes the confirmed delivery date/window when passed, inserted between the total and the payment wording", () => {
    const message = buildQuoteTextMessage("Jane Rivera", 4800, { date: "2026-09-03", time: "18:00" });
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Your order total is $48.\n" +
        "We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.\n\n" +
        "Cash or Zelle accepted. You can pay cash at the door when we deliver.\n\n" +
        "Please reply if you have any questions."
    );
  });

  it("falls back gracefully to the delivery-free format when confirmedDelivery is explicitly null", () => {
    expect(buildQuoteTextMessage("Jane Rivera", 4800, null)).toBe(buildQuoteTextMessage("Jane Rivera", 4800));
  });

  it("falls back gracefully when confirmedDelivery is simply omitted (legacy call sites)", () => {
    expect(buildQuoteTextMessage("Jane Rivera", 4800, undefined)).toBe(
      buildQuoteTextMessage("Jane Rivera", 4800)
    );
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

  it("preserves the quote message's paragraph and line-break formatting through the SMS link", () => {
    const href = bookingQuoteTextHref("7185550134", "Jane Rivera", 4800, {
      date: "2026-09-03",
      time: "18:00",
    });
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("Mars Laundromat.\n\nYour order total is $48.");
    expect(decoded).toContain("$48.\nWe'll deliver it back");
    expect(decoded).toContain("when we deliver.\n\nPlease reply");
  });

  it("passes a confirmed delivery window through to the encoded message", () => {
    const href = bookingQuoteTextHref("7185550134", "Jane Rivera", 4800, {
      date: "2026-09-03",
      time: "18:00",
    });
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.");
  });
});

describe("buildPickupConfirmationMessage", () => {
  const pickup = { date: "2026-09-02", time: "09:00" };
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("includes the customer's real name, not a placeholder", () => {
    expect(buildPickupConfirmationMessage("Wei Chen", "wash_and_fold", pickup, delivery)).toMatch(
      /^Hi Wei Chen,/
    );
  });

  it("uses clear customer-facing English for each service type, never the internal bilingual/staff labels", () => {
    const washAndFold = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    const dryCleaning = buildPickupConfirmationMessage("Jane", "dry_cleaning", pickup, delivery);
    const both = buildPickupConfirmationMessage("Jane", "both", pickup, delivery);
    expect(washAndFold).toContain("Your Wash & Fold pickup is confirmed");
    expect(dryCleaning).toContain("Your Dry Cleaning & Ironing pickup is confirmed");
    expect(both).toContain("Your Wash & Fold and Dry Cleaning & Ironing pickup is confirmed");
    for (const message of [washAndFold, dryCleaning, both]) {
      expect(message).not.toMatch(/[一-鿿]/); // no Chinese characters — English-only per spec
      expect(message).not.toContain("Both Services"); // the internal admin-badge shorthand
    }
  });

  it("formats the confirmed pickup date and one-hour window correctly", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("confirmed for Wed, Sep 2, 9:00 AM–10:00 AM.");
  });

  it("formats the confirmed delivery date and window correctly", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.");
  });

  it("states the final total will be texted after the order is received and weighed/counted", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("We'll text your final total once we've received your order and finished weighing/counting it.");
  });

  it("invites a reply for questions", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("Please reply if you have any questions.");
  });

  it("uses readable paragraph breaks and puts pickup and delivery on separate lines", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("Mars Laundromat.\n\nYour Wash & Fold pickup");
    expect(message).toContain("9:00 AM–10:00 AM.\nWe'll deliver it back");
    expect(message).toContain("weighing/counting it.\n\nPlease reply");
  });

  it("never mentions price, payment, or Zelle — that's the separate, later quote text", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).not.toMatch(/\$\d/);
    expect(message).not.toContain("Zelle");
    expect(message).not.toContain("Cash");
  });
});

describe("bookingPickupConfirmationTextHref", () => {
  const pickup = { date: "2026-09-02", time: "09:00" };
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("combines the phone and message into one properly-encoded sms: link", () => {
    const href = bookingPickupConfirmationTextHref(
      "(718) 555-0134",
      "Jane Rivera",
      "wash_and_fold",
      pickup,
      delivery
    );
    expect(href.startsWith("sms:7185550134?body=")).toBe(true);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe(buildPickupConfirmationMessage("Jane Rivera", "wash_and_fold", pickup, delivery));
  });

  it("round-trips through encode/decode without corrupting punctuation or the en dash", () => {
    const href = bookingPickupConfirmationTextHref("7185550134", "Jane Rivera", "both", pickup, delivery);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("9:00 AM–10:00 AM");
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
