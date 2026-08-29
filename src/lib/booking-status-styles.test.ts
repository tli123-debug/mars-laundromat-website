import { describe, expect, it } from "vitest";
import { BOOKING_STATUS_STYLES } from "./booking-status-styles";
import type { BookingStatus } from "@/types/database.types";

const ALL_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "picked_up",
  "ready_for_delivery",
  "completed",
  "cancelled",
];

describe("BOOKING_STATUS_STYLES", () => {
  it("has a trigger and item entry for every BookingStatus", () => {
    for (const status of ALL_STATUSES) {
      expect(BOOKING_STATUS_STYLES[status]).toBeDefined();
      expect(BOOKING_STATUS_STYLES[status]).toHaveProperty("trigger");
      expect(BOOKING_STATUS_STYLES[status]).toHaveProperty("item");
    }
  });

  it("gives the four active statuses a real, distinct color treatment", () => {
    const active: BookingStatus[] = ["pending", "confirmed", "picked_up", "ready_for_delivery"];
    const triggers = active.map((status) => BOOKING_STATUS_STYLES[status].trigger);
    for (const trigger of triggers) {
      expect(trigger).not.toBe("");
    }
    expect(new Set(triggers).size).toBe(active.length);
  });

  it("keeps completed/cancelled on neutral (existing) styling", () => {
    expect(BOOKING_STATUS_STYLES.completed.trigger).toBe("");
    expect(BOOKING_STATUS_STYLES.completed.item).toBe("");
    expect(BOOKING_STATUS_STYLES.cancelled.trigger).toBe("");
    expect(BOOKING_STATUS_STYLES.cancelled.item).toBe("");
  });
});
