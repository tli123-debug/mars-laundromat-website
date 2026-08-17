type FeaturedReview = {
  name: string;
  quote: string;
};

/**
 * Hand-picked, not live-fetched — deliberate choice over the Google Places API
 * (which caps review text at 5 with no control over which ones show) or a
 * third-party widget (recurring cost, limited theme control). See chat for
 * the reasoning. All values below are PLACEHOLDERS — replace with the real
 * current rating/count from the Google Business Profile, and 5 real review
 * quotes copied exactly (don't paraphrase).
 */
export const googleReviews = {
  rating: 5.0,
  reviewCount: 27,

  /**
   * PLACEHOLDER — swap for the direct "write a review" deep link once you
   * have the Place ID: https://search.google.com/local/writereview?placeid=...
   * (grab it free from Google's Place ID Finder, no API key needed). Until
   * then this just opens the Maps listing.
   */
  writeReviewHref:
    "https://www.google.com/maps/search/?api=1&query=Mars+Laundromat+450+6th+Ave+Brooklyn+NY",

  featured: [
    { name: "TODO: reviewer name", quote: "TODO: paste the real review text here." },
    { name: "TODO: reviewer name", quote: "TODO: paste the real review text here." },
    { name: "TODO: reviewer name", quote: "TODO: paste the real review text here." },
    { name: "TODO: reviewer name", quote: "TODO: paste the real review text here." },
    { name: "TODO: reviewer name", quote: "TODO: paste the real review text here." },
  ] satisfies FeaturedReview[],
} as const;
