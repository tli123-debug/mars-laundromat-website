import { describe, expect, it } from "vitest";
import {
  bookingMapsHref,
  bookingPhoneHref,
  bookingPickupConfirmationTextHref,
  bookingProposedDeliveryTextHref,
  bookingProposedScheduleTextHref,
  bookingQuoteTextHref,
  bookingRecurringOfferTextHref,
  bookingSmsHref,
  buildPickupConfirmationMessage,
  buildProposedDeliveryMessage,
  buildProposedScheduleMessage,
  buildQuoteTextMessage,
  buildRecurringOfferMessage,
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
  it("matches the exact owner-approved wording, with both the Zelle and Venmo detail lines", () => {
    const message = buildQuoteTextMessage("Jane Rivera", 4800);
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Your order total is $48.\n\n" +
        "Cash, Zelle, or Venmo accepted.\n" +
        "Zelle: 917-881-2623\n" +
        "Venmo: @Yong-Li-234\n" +
        "You can pay cash at the door when we deliver.\n\n" +
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

  it("lists both Zelle and Venmo in the 'accepted' sentence, each with its own detail line, in that order", () => {
    const message = buildQuoteTextMessage("Jane", 4800);
    expect(message).toContain("Cash, Zelle, or Venmo accepted.\nZelle: 917-881-2623\nVenmo: @Yong-Li-234\n");
  });

  it("includes the confirmed delivery date/window when passed, inserted between the total and the payment wording", () => {
    const message = buildQuoteTextMessage("Jane Rivera", 4800, { date: "2026-09-03", time: "18:00" });
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Your order total is $48.\n" +
        "We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.\n\n" +
        "Cash, Zelle, or Venmo accepted.\n" +
        "Zelle: 917-881-2623\n" +
        "Venmo: @Yong-Li-234\n" +
        "You can pay cash at the door when we deliver.\n\n" +
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

  it("matches the exact owner-approved wording, including the availability/handoff-policy paragraph", () => {
    const message = buildPickupConfirmationMessage("Jane Rivera", "wash_and_fold", pickup, delivery);
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Your Wash & Fold pickup is confirmed for Wed, Sep 2, 9:00 AM–10:00 AM.\n" +
        "We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.\n\n" +
        "Please make sure someone or a doorman is AVAILABLE to hand off and receive your laundry " +
        "during those windows — if your plans change, call or text us to pick a different time. " +
        "We're not able to leave items unattended unless we've specifically agreed on it.\n\n" +
        "We'll text your final total once we've received your order and finished weighing/counting it.\n\n" +
        "Please reply if you have any questions."
    );
  });

  it("states the availability/handoff policy on its own paragraph, between the delivery line and the final-total line", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("We'll deliver it back Thu, Sep 3, 6:00 PM–7:00 PM.\n\nPlease make sure someone");
    expect(message).toContain("agreed on it.\n\nWe'll text your final total");
  });

  it("names the unattended-handoff policy explicitly, covering both pickup hand off and delivery receipt", () => {
    const message = buildPickupConfirmationMessage("Jane", "wash_and_fold", pickup, delivery);
    expect(message).toContain("someone or a doorman is AVAILABLE to hand off and receive your laundry");
    expect(message).toContain("We're not able to leave items unattended unless we've specifically agreed on it.");
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

describe("buildProposedScheduleMessage", () => {
  const pickup = { date: "2026-09-02", time: "09:00" };
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("matches the exact owner-approved wording and paragraph breaks", () => {
    const message = buildProposedScheduleMessage("Jane Rivera", pickup, delivery);
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "We need to adjust the schedule you requested. Would the following work for you?\n\n" +
        "Pickup: Wed, Sep 2, 9:00 AM–10:00 AM\n" +
        "Delivery: Thu, Sep 3, 6:00 PM–7:00 PM\n\n" +
        "Please reply to confirm, or let us know what time would work better."
    );
  });

  it("uses the customer's real name, not a placeholder", () => {
    expect(buildProposedScheduleMessage("Wei Chen", pickup, delivery)).toMatch(/^Hi Wei Chen,/);
  });

  it("always includes both pickup and delivery, even when only one actually changed from the request", () => {
    const message = buildProposedScheduleMessage("Jane", pickup, delivery);
    expect(message).toContain("Pickup: Wed, Sep 2, 9:00 AM–10:00 AM");
    expect(message).toContain("Delivery: Thu, Sep 3, 6:00 PM–7:00 PM");
  });

  it("invites a reply to confirm or propose something else, never a hard commitment", () => {
    expect(buildProposedScheduleMessage("Jane", pickup, delivery)).toContain(
      "Please reply to confirm, or let us know what time would work better."
    );
  });
});

describe("bookingProposedScheduleTextHref", () => {
  const pickup = { date: "2026-09-02", time: "09:00" };
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("combines the phone and message into one properly-encoded sms: link", () => {
    const href = bookingProposedScheduleTextHref("(718) 555-0134", "Jane Rivera", pickup, delivery);
    expect(href.startsWith("sms:7185550134?body=")).toBe(true);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe(buildProposedScheduleMessage("Jane Rivera", pickup, delivery));
  });

  it("preserves paragraph and line-break formatting through the encoded SMS link", () => {
    const href = bookingProposedScheduleTextHref("7185550134", "Jane Rivera", pickup, delivery);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("Mars Laundromat.\n\nWe need to adjust");
    expect(decoded).toContain("Pickup: Wed, Sep 2, 9:00 AM–10:00 AM\nDelivery: Thu, Sep 3, 6:00 PM–7:00 PM");
    expect(decoded).toContain("PM\n\nPlease reply to confirm");
  });
});

describe("buildProposedDeliveryMessage", () => {
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("matches the exact owner-approved wording, including the availability/handoff-policy line", () => {
    const message = buildProposedDeliveryMessage("Jane Rivera", delivery);
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "We need to adjust your delivery schedule. Would the following time work for you?\n\n" +
        "Delivery: Thu, Sep 3, 6:00 PM–7:00 PM\n\n" +
        "Please make sure someone or a doorman will be AVAILABLE to receive your laundry during " +
        "that window. We're not able to leave items unattended unless we've specifically agreed on it.\n\n" +
        "Please reply to confirm, or let us know what time would work better."
    );
  });

  it("uses the customer's real name, not a placeholder", () => {
    expect(buildProposedDeliveryMessage("Wei Chen", delivery)).toMatch(/^Hi Wei Chen,/);
  });

  it("never mentions pickup — pickup is already historical by the time this message is used", () => {
    expect(buildProposedDeliveryMessage("Jane", delivery)).not.toContain("Pickup");
    expect(buildProposedDeliveryMessage("Jane", delivery)).not.toContain("hand off");
  });

  it("carries the same availability/handoff policy as buildPickupConfirmationMessage, so a rescheduled delivery is never left without the reminder", () => {
    const message = buildProposedDeliveryMessage("Jane", delivery);
    expect(message).toContain("AVAILABLE to receive your laundry");
    expect(message).toContain("We're not able to leave items unattended unless we've specifically agreed on it.");
  });
});

describe("bookingProposedDeliveryTextHref", () => {
  const delivery = { date: "2026-09-03", time: "18:00" };

  it("combines the phone and message into one properly-encoded sms: link", () => {
    const href = bookingProposedDeliveryTextHref("(718) 555-0134", "Jane Rivera", delivery);
    expect(href.startsWith("sms:7185550134?body=")).toBe(true);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe(buildProposedDeliveryMessage("Jane Rivera", delivery));
  });

  it("preserves paragraph and line-break formatting through the encoded SMS link", () => {
    const href = bookingProposedDeliveryTextHref("7185550134", "Jane Rivera", delivery);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("Mars Laundromat.\n\nWe need to adjust your delivery schedule");
    expect(decoded).toContain("Delivery: Thu, Sep 3, 6:00 PM–7:00 PM\n\nPlease make sure someone");
    expect(decoded).toContain("agreed on it.\n\nPlease reply to confirm");
  });
});

describe("quote message remains unchanged by this task", () => {
  it("buildQuoteTextMessage is untouched (Zelle/Venmo wording task, not this one)", () => {
    const message = buildQuoteTextMessage("Jane Rivera", 4800);
    expect(message).toContain("Cash, Zelle, or Venmo accepted.");
    expect(message).toContain("Zelle: 917-881-2623");
    expect(message).toContain("Venmo: @Yong-Li-234");
  });
});

describe("buildRecurringOfferMessage", () => {
  it("matches the exact owner-approved wording and line-break structure", () => {
    const message = buildRecurringOfferMessage("Jane Rivera");
    expect(message).toBe(
      "Hi Jane Rivera, this is Mars Laundromat.\n\n" +
        "Thank you for choosing us. We hope everything came back just the way you wanted.\n\n" +
        "If you'd like, we can set up a recurring Wash & Fold pickup every week or every two weeks, so you won't need to book each time.\n\n" +
        "Reply WEEKLY or EVERY 2 WEEKS if you're interested, or let us know if you have any questions."
    );
  });

  it("always says Wash & Fold, regardless of what service the source order actually was — the function takes no service-type parameter at all", () => {
    // There is no serviceType argument to pass a 'both' value into in the
    // first place — this test documents that omission is deliberate, not
    // an oversight, per the locked rule that recurring offers are always
    // Wash & Fold-only wording. Eligibility (including for a completed
    // Both order) is decided separately by isEligibleForRecurringOffer().
    expect(buildRecurringOfferMessage.length).toBe(1);
    expect(buildRecurringOfferMessage("Anyone")).toContain("recurring Wash & Fold pickup");
    expect(buildRecurringOfferMessage("Anyone")).not.toContain("Both Services");
  });

  it("the message template itself stays English-only, unlike the bilingual admin-facing button labels", () => {
    const message = buildRecurringOfferMessage("Jane Rivera");
    // eslint-disable-next-line no-misleading-character-class
    expect(message).not.toMatch(/[一-鿿]/);
  });
});

describe("bookingRecurringOfferTextHref", () => {
  it("combines the phone and message into one properly-encoded sms: link", () => {
    const href = bookingRecurringOfferTextHref("(718) 555-0134", "Jane Rivera");
    expect(href.startsWith("sms:7185550134?body=")).toBe(true);
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toBe(buildRecurringOfferMessage("Jane Rivera"));
  });

  it("round-trips through encode/decode without corrupting punctuation, apostrophes, or line breaks", () => {
    const href = bookingRecurringOfferTextHref("7185550134", "Jane Rivera");
    const decoded = decodeURIComponent(href.split("?body=")[1]);
    expect(decoded).toContain("If you'd like, we can set up a recurring Wash & Fold pickup every week or every two weeks, so you won't need to book each time.");
    expect(decoded).toContain("Reply WEEKLY or EVERY 2 WEEKS if you're interested, or let us know if you have any questions.");
    expect(decoded.split("\n\n")).toHaveLength(4);
  });

  it("never marks anything as sent — this is a plain sms: link with no side effect of its own", () => {
    const href = bookingRecurringOfferTextHref("7185550134", "Jane Rivera");
    expect(href.startsWith("sms:")).toBe(true);
    expect(href).not.toContain("sent=");
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
