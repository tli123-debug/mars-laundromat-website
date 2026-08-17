type FeaturedReview = {
  name: string;
  quote: string;
};

/**
 * Hand-picked, not live-fetched — deliberate choice over the Google Places API
 * (which caps review text at 5 with no control over which ones show) or a
 * third-party widget (recurring cost, limited theme control). See chat for
 * the reasoning.
 *
 * rating/reviewCount as of 2026-08-19 — these drift over time and aren't
 * live-fetched, so revisit periodically rather than assuming they stay accurate.
 */
export const googleReviews = {
  rating: 4.8,
  reviewCount: 28,

  // Place ID: ChIJHyr0Pv1awokRGuD5XNAJe9c (450 6th Ave, Brooklyn, NY 11215)
  writeReviewHref:
    "https://search.google.com/local/writereview?placeid=ChIJHyr0Pv1awokRGuD5XNAJe9c",

  featured: [
    {
      name: "bobbi menuez",
      quote:
        "I've been coming to Mars my whole life, great reliable neighborhood laundromat. Friendliest hard working staff & owners. I especially love the incredibly cared for plants that wrap around the outdoor seating area, like a little oasis. Consider meditating on the front bench amidst the lush foliage while your laundry is spinning inside 🤍",
    },
    {
      name: "Franky J",
      quote:
        "I've been coming to this laundromat since I was young, and now I'm here doing laundry for my own family. It's been a dependable part of our neighborhood for many years. It's nice to have a place I've known for so long and can continue to rely on. Definitely a place I'm happy to support a family owned business. Everyone is great here.",
    },
    {
      name: "Nicole G",
      quote:
        "Great overall! I do drop off for wash/fold & they are always timely, well priced, & have a quick turnaround. 9/10 times it is same day & the one time it wasn't, it was on me for bringing it in late. Cash only but great prices.",
    },
    {
      name: "Fairh Karg",
      quote:
        "Best laundry place in the city. The prices are reasonable, the man who ran the shop was beyond lovely and helpful, and they have machines big enough to clean my 40lb. Washable rug! I brought a book and was delighted to sit in the charming garden and wait for my clothes to finish. 10/10",
    },
    {
      name: "Hallie Brevetti",
      quote:
        "I could not recommend Lee and Mars Laundromat more! Lee and his staff are so attentive. I actually look forward to going to the laundromat, lol.",
    },
  ] satisfies FeaturedReview[],
} as const;
