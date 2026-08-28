import { describe, expect, it } from "vitest";
import {
  ACTIVE_BOOKING_STATUSES,
  ARCHIVED_BOOKING_STATUSES,
  categorizeBooking,
  type BookingColumn,
} from "./categorize-booking";
import type { BookingStatus, QuoteStatus } from "@/types/database.types";

const TODAY = "2026-08-24";
const YESTERDAY = "2026-08-23";
const TOMORROW = "2026-08-25";

interface TestBooking {
  status: BookingStatus;
  confirmed_pickup_date: string | null;
  actual_weight_lb?: number | null; // unused by categorizeBooking, included for table fidelity
  confirmed_delivery_date: string | null;
  paid: boolean;
  quote_status: QuoteStatus;
}

function booking(overrides: Partial<TestBooking> = {}): TestBooking {
  return {
    status: "pending",
    confirmed_pickup_date: null,
    confirmed_delivery_date: null,
    paid: false,
    quote_status: "not_started",
    ...overrides,
  };
}

describe("categorizeBooking — the table from the plan", () => {
  it("confirmed, pickup yesterday -> todays_pickups (missed pickup stays visible)", () => {
    const result = categorizeBooking(
      booking({ status: "confirmed", confirmed_pickup_date: YESTERDAY }),
      TODAY
    );
    expect(result).toEqual(["todays_pickups"]);
  });

  it("confirmed, no pickup date set -> todays_pickups", () => {
    const result = categorizeBooking(booking({ status: "confirmed" }), TODAY);
    expect(result).toEqual(["todays_pickups"]);
  });

  it("confirmed, pickup tomorrow -> [] (legitimately future)", () => {
    const result = categorizeBooking(
      booking({ status: "confirmed", confirmed_pickup_date: TOMORROW }),
      TODAY
    );
    expect(result).toEqual([]);
  });

  it("picked_up, pickup yesterday, never weighed -> at_store", () => {
    const result = categorizeBooking(
      booking({ status: "picked_up", confirmed_pickup_date: YESTERDAY }),
      TODAY
    );
    expect(result).toEqual(["at_store"]);
  });

  it("cancelled, unpaid, quote sent -> [] (not unpaid — closes the leak)", () => {
    const result = categorizeBooking(
      booking({ status: "cancelled", paid: false, quote_status: "sent" }),
      TODAY
    );
    expect(result).toEqual([]);
  });

  it("completed and paid -> [] (done, nothing left to do)", () => {
    const result = categorizeBooking(
      booking({ status: "completed", paid: true, quote_status: "sent" }),
      TODAY
    );
    expect(result).toEqual([]);
  });

  it("completed, unpaid, quote sent -> unpaid (done but unbilled)", () => {
    const result = categorizeBooking(
      booking({ status: "completed", paid: false, quote_status: "sent" }),
      TODAY
    );
    expect(result).toEqual(["unpaid"]);
  });

  it("picked_up, weighed, unpaid, quote sent -> at_store AND unpaid (intentional overlap)", () => {
    const result = categorizeBooking(
      booking({ status: "picked_up", actual_weight_lb: 20, paid: false, quote_status: "sent" }),
      TODAY
    );
    expect(result.sort()).toEqual(["at_store", "unpaid"].sort());
  });

  it("ready_for_delivery, delivery today -> ready_for_delivery AND todays_deliveries", () => {
    const result = categorizeBooking(
      booking({ status: "ready_for_delivery", confirmed_delivery_date: TODAY }),
      TODAY
    );
    expect(result.sort()).toEqual(["ready_for_delivery", "todays_deliveries"].sort());
  });
});

describe("categorizeBooking — targeted invariants (not a blanket never-empty claim)", () => {
  it("invariant A: confirmed + confirmed_pickup_date <= today always includes todays_pickups", () => {
    for (const date of [YESTERDAY, TODAY]) {
      const result = categorizeBooking(
        booking({ status: "confirmed", confirmed_pickup_date: date }),
        TODAY
      );
      expect(result).toContain("todays_pickups");
    }
  });

  it("invariant B: picked_up always includes at_store, regardless of date or weight", () => {
    const cases: Partial<TestBooking>[] = [
      { status: "picked_up" },
      { status: "picked_up", confirmed_pickup_date: YESTERDAY },
      { status: "picked_up", confirmed_pickup_date: TOMORROW },
      { status: "picked_up", actual_weight_lb: null },
      { status: "picked_up", actual_weight_lb: 15 },
    ];
    for (const c of cases) {
      expect(categorizeBooking(booking(c), TODAY)).toContain("at_store");
    }
  });

  it("invariant C: ready_for_delivery + confirmed_delivery_date <= today always includes todays_deliveries", () => {
    for (const date of [YESTERDAY, TODAY]) {
      const result = categorizeBooking(
        booking({ status: "ready_for_delivery", confirmed_delivery_date: date }),
        TODAY
      );
      expect(result).toContain("todays_deliveries");
    }
  });

  it("invariant D: unpaid + quote sent + not cancelled always includes unpaid", () => {
    const nonCancelledStatuses: BookingStatus[] = [
      "pending",
      "confirmed",
      "picked_up",
      "ready_for_delivery",
      "completed",
    ];
    for (const status of nonCancelledStatuses) {
      const result = categorizeBooking(booking({ status, paid: false, quote_status: "sent" }), TODAY);
      expect(result).toContain("unpaid");
    }
  });

  it("cancelled is always [] regardless of any other field", () => {
    const result = categorizeBooking(
      booking({
        status: "cancelled",
        confirmed_pickup_date: YESTERDAY,
        confirmed_delivery_date: YESTERDAY,
        paid: false,
        quote_status: "sent",
      }),
      TODAY
    );
    expect(result).toEqual([]);
  });
});

describe("categorizeBooking — intentional absences", () => {
  it("a future confirmed_pickup_date never produces todays_pickups", () => {
    const result = categorizeBooking(
      booking({ status: "confirmed", confirmed_pickup_date: TOMORROW }),
      TODAY
    );
    expect(result).not.toContain("todays_pickups");
  });

  it("a future confirmed_delivery_date never produces todays_deliveries", () => {
    const result = categorizeBooking(
      booking({ status: "ready_for_delivery", confirmed_delivery_date: TOMORROW }),
      TODAY
    );
    expect(result).not.toContain("todays_deliveries");
  });

  it("a fresh pending booking with no proposed time is pending_review, not awaiting_customer", () => {
    const result = categorizeBooking(booking({ status: "pending" }), TODAY);
    expect(result).toEqual(["pending_review"]);
  });

  it("a pending booking with a proposed time is awaiting_customer, not pending_review", () => {
    const result = categorizeBooking(
      booking({ status: "pending", confirmed_pickup_date: TOMORROW }),
      TODAY
    );
    expect(result).toEqual(["awaiting_customer"]);
  });
});

describe("ACTIVE_BOOKING_STATUSES / ARCHIVED_BOOKING_STATUSES", () => {
  const ALL_STATUSES: BookingStatus[] = [
    "pending",
    "confirmed",
    "picked_up",
    "ready_for_delivery",
    "completed",
    "cancelled",
  ];

  it("together cover every BookingStatus exactly once — no gaps, no overlap", () => {
    const combined = [...ACTIVE_BOOKING_STATUSES, ...ARCHIVED_BOOKING_STATUSES].sort();
    expect(combined).toEqual([...ALL_STATUSES].sort());
    expect(new Set(combined).size).toBe(combined.length);
  });

  it("archived is exactly the two terminal statuses", () => {
    expect([...ARCHIVED_BOOKING_STATUSES].sort()).toEqual(["cancelled", "completed"]);
  });
});

describe("categorizeBooking — return type sanity", () => {
  it("only ever returns known BookingColumn values", () => {
    const validColumns: BookingColumn[] = [
      "pending_review",
      "awaiting_customer",
      "todays_pickups",
      "at_store",
      "ready_for_delivery",
      "todays_deliveries",
      "unpaid",
    ];
    const result = categorizeBooking(
      booking({ status: "picked_up", paid: false, quote_status: "sent" }),
      TODAY
    );
    for (const column of result) {
      expect(validColumns).toContain(column);
    }
  });
});
