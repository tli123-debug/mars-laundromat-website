import { describe, expect, it } from "vitest";
import {
  AD_ATTRIBUTION_STORAGE_KEY,
  AD_ATTRIBUTION_TTL_MS,
  captureAdAttribution,
  clearAdAttribution,
  parseAdAttribution,
  readAdAttribution,
  storedAdSource,
  type AttributionStorage,
} from "./ad-attribution";

class FakeStorage implements AttributionStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const NOW = 1_800_000_000_000;

describe("parseAdAttribution — what counts as a Google Ads visit", () => {
  it("treats a gclid as a Google Ads click and keeps the ID", () => {
    const result = parseAdAttribution("?gclid=Cj0KCQiA_abc-123", NOW);
    expect(result).toMatchObject({ source: "google_ads", gclid: "Cj0KCQiA_abc-123", capturedAt: NOW });
  });

  it("treats the iOS-privacy click IDs (gbraid, wbraid) as Google Ads too", () => {
    expect(parseAdAttribution("?gbraid=0AAAAAabc123", NOW)?.source).toBe("google_ads");
    expect(parseAdAttribution("?wbraid=CjkAAAabc123", NOW)?.source).toBe("google_ads");
  });

  it("treats utm_source=google with a paid medium as Google Ads, case-insensitively", () => {
    expect(parseAdAttribution("?utm_source=Google&utm_medium=CPC", NOW)?.source).toBe("google_ads");
    expect(parseAdAttribution("?utm_source=google&utm_medium=ppc&utm_campaign=pickup", NOW)).toMatchObject({
      source: "google_ads",
      utmCampaign: "pickup",
    });
  });

  it("does not call a google/organic UTM visit a Google Ads click", () => {
    const result = parseAdAttribution("?utm_source=google&utm_medium=organic", NOW);
    expect(result?.source).toBeNull();
    expect(result?.utmMedium).toBe("organic");
  });

  it("lets an explicit valid ?source= win over a click ID", () => {
    expect(parseAdAttribution("?source=google_business&gclid=abc123", NOW)?.source).toBe("google_business");
  });

  it("accepts the Business Profile booking link exactly as it is set up", () => {
    expect(parseAdAttribution("?source=google_business", NOW)).toMatchObject({ source: "google_business" });
  });

  it("returns null when there is nothing worth remembering", () => {
    expect(parseAdAttribution("", NOW)).toBeNull();
    expect(parseAdAttribution("?page=2&ref=abc", NOW)).toBeNull();
  });

  it("ignores an unrecognized ?source= on its own", () => {
    expect(parseAdAttribution("?source=totally-made-up", NOW)).toBeNull();
  });

  it("drops a click ID that isn't shaped like one (spaces, quotes, tags)", () => {
    expect(parseAdAttribution("?gclid=" + encodeURIComponent("<script>alert(1)</script>"), NOW)).toBeNull();
    expect(parseAdAttribution("?gclid=" + encodeURIComponent("abc def"), NOW)).toBeNull();
  });

  it("trims UTM values, strips control characters, and caps their length", () => {
    const long = "x".repeat(300);
    const result = parseAdAttribution(
      `?utm_campaign=${encodeURIComponent("  spring\u0007sale  ")}&utm_term=${long}`,
      NOW
    );
    expect(result?.utmCampaign).toBe("springsale");
    expect(result?.utmTerm).toHaveLength(100);
  });
});

describe("storage — remembering the visit across pages", () => {
  it("round-trips a captured visit", () => {
    const storage = new FakeStorage();
    captureAdAttribution(storage, "?gclid=abc123456&utm_campaign=pickup", NOW);
    expect(readAdAttribution(storage, NOW + 1000)).toMatchObject({
      source: "google_ads",
      gclid: "abc123456",
      utmCampaign: "pickup",
    });
    expect(storedAdSource(storage, NOW + 1000)).toBe("google_ads");
  });

  it("lets a newer tracked visit replace an older one (last touch wins)", () => {
    const storage = new FakeStorage();
    captureAdAttribution(storage, "?gclid=abc123456", NOW);
    captureAdAttribution(storage, "?source=google_business", NOW + 5000);
    expect(storedAdSource(storage, NOW + 6000)).toBe("google_business");
  });

  it("leaves an earlier ad click alone when a later visit carries nothing", () => {
    const storage = new FakeStorage();
    captureAdAttribution(storage, "?gclid=abc123456", NOW);
    expect(captureAdAttribution(storage, "", NOW + 5000)).toBeNull();
    expect(storedAdSource(storage, NOW + 6000)).toBe("google_ads");
  });

  it("forgets a visit after 30 days and cleans it up", () => {
    const storage = new FakeStorage();
    captureAdAttribution(storage, "?gclid=abc123456", NOW);
    expect(readAdAttribution(storage, NOW + AD_ATTRIBUTION_TTL_MS)).not.toBeNull();
    expect(readAdAttribution(storage, NOW + AD_ATTRIBUTION_TTL_MS + 1)).toBeNull();
    expect(storage.data.has(AD_ATTRIBUTION_STORAGE_KEY)).toBe(false);
  });

  it("clears the memory after a booking so the next order isn't credited to the same click", () => {
    const storage = new FakeStorage();
    captureAdAttribution(storage, "?gclid=abc123456", NOW);
    clearAdAttribution(storage);
    expect(storedAdSource(storage, NOW + 1000)).toBeNull();
  });

  it("ignores corrupted or foreign data instead of throwing", () => {
    const storage = new FakeStorage();
    storage.setItem(AD_ATTRIBUTION_STORAGE_KEY, "{not json");
    expect(readAdAttribution(storage, NOW)).toBeNull();
    storage.setItem(AD_ATTRIBUTION_STORAGE_KEY, JSON.stringify({ source: "not_a_source", capturedAt: NOW }));
    expect(readAdAttribution(storage, NOW)).toBeNull();
    storage.setItem(AD_ATTRIBUTION_STORAGE_KEY, JSON.stringify({ source: "google_ads" }));
    expect(readAdAttribution(storage, NOW)).toBeNull();
  });

  it("never throws when storage is unavailable or fails", () => {
    expect(() => captureAdAttribution(null, "?gclid=abc123456", NOW)).not.toThrow();
    expect(readAdAttribution(null, NOW)).toBeNull();
    expect(() => clearAdAttribution(null)).not.toThrow();

    const broken: AttributionStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    expect(() => captureAdAttribution(broken, "?gclid=abc123456", NOW)).not.toThrow();
    expect(readAdAttribution(broken, NOW)).toBeNull();
    expect(() => clearAdAttribution(broken)).not.toThrow();
  });
});
