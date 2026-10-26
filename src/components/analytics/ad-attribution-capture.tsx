"use client";

import { useEffect } from "react";
import { captureAdAttribution, getBrowserStorage } from "@/lib/ad-attribution";

/**
 * Runs once when a page loads and remembers a Google Ads click ID, UTM
 * values, or a ?source= tracked link, so the booking form can still tag the
 * booking after the visitor browses to /book. Renders nothing.
 */
export function AdAttributionCapture() {
  useEffect(() => {
    captureAdAttribution(getBrowserStorage(), window.location.search, Date.now());
  }, []);

  return null;
}
