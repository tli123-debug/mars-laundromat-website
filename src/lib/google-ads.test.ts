import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBookingConversionEvent,
  getBookingConversionSendTo,
  getGoogleAdsId,
  sanitizeConversionLabel,
  sanitizeGoogleAdsId,
  trackBookingConversion,
} from "./google-ads";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sanitizeGoogleAdsId", () => {
  it("accepts a real-looking Google Ads ID", () => {
    expect(sanitizeGoogleAdsId("AW-123456789")).toBe("AW-123456789");
    expect(sanitizeGoogleAdsId("  AW-123456789  ")).toBe("AW-123456789");
  });

  it("rejects anything else, including attempts to break out of the inline script", () => {
    expect(sanitizeGoogleAdsId("")).toBeNull();
    expect(sanitizeGoogleAdsId(undefined)).toBeNull();
    expect(sanitizeGoogleAdsId("G-ABCDEF1234")).toBeNull();
    expect(sanitizeGoogleAdsId("AW-12")).toBeNull();
    expect(sanitizeGoogleAdsId("AW-123456789');alert(1);//")).toBeNull();
    expect(sanitizeGoogleAdsId("aw-123456789")).toBeNull();
  });
});

describe("sanitizeConversionLabel", () => {
  it("accepts a normal label and rejects anything with odd characters", () => {
    expect(sanitizeConversionLabel("AbCdEfGh-ijk_123")).toBe("AbCdEfGh-ijk_123");
    expect(sanitizeConversionLabel("short")).toBeNull();
    expect(sanitizeConversionLabel("has space inside")).toBeNull();
    expect(sanitizeConversionLabel("quote'")).toBeNull();
    expect(sanitizeConversionLabel(undefined)).toBeNull();
  });
});

describe("environment configuration", () => {
  it("is completely off when nothing is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL", "");
    expect(getGoogleAdsId()).toBeNull();
    expect(getBookingConversionSendTo()).toBeNull();
  });

  it("loads the tag but sends no conversions until the label is also set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL", "");
    expect(getGoogleAdsId()).toBe("AW-123456789");
    expect(getBookingConversionSendTo()).toBeNull();
  });

  it("builds send_to from the ID and label together", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL", "AbCdEfGh-ijk_123");
    expect(getBookingConversionSendTo()).toBe("AW-123456789/AbCdEfGh-ijk_123");
  });

  it("ignores a malformed ID or label instead of using it", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "not-an-id");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL", "AbCdEfGh-ijk_123");
    expect(getBookingConversionSendTo()).toBeNull();
  });
});

describe("trackBookingConversion", () => {
  it("reports the booking to Google with the booking ID as the transaction ID", () => {
    const gtag = vi.fn();
    const sent = trackBookingConversion("booking-uuid-1", { sendTo: "AW-123456789/AbCdEfGh", gtag });
    expect(sent).toBe(true);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-123456789/AbCdEfGh",
      transaction_id: "booking-uuid-1",
    });
  });

  it("sends nothing when tracking isn't configured", () => {
    const gtag = vi.fn();
    expect(trackBookingConversion("booking-uuid-1", { sendTo: null, gtag })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sends nothing when the Google tag isn't present (blocked or not loaded)", () => {
    expect(trackBookingConversion("booking-uuid-1", { sendTo: "AW-123456789/AbCdEfGh", gtag: undefined })).toBe(
      false
    );
  });

  it("sends nothing without a booking ID", () => {
    const gtag = vi.fn();
    expect(trackBookingConversion("", { sendTo: "AW-123456789/AbCdEfGh", gtag })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("swallows a failure inside the tag so a booking can never be affected", () => {
    const gtag = vi.fn(() => {
      throw new Error("tag exploded");
    });
    expect(() => trackBookingConversion("booking-uuid-1", { sendTo: "AW-123456789/AbCdEfGh", gtag })).not.toThrow();
    expect(trackBookingConversion("booking-uuid-1", { sendTo: "AW-123456789/AbCdEfGh", gtag })).toBe(false);
  });

  it("builds the event exactly as Google's snippet expects", () => {
    expect(buildBookingConversionEvent("AW-1/abc", "id-9")).toEqual({
      send_to: "AW-1/abc",
      transaction_id: "id-9",
    });
  });
});
