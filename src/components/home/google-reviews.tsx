import { Star } from "lucide-react";
import { googleReviews } from "@/content/reviews";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i < Math.round(rating)
              ? "h-4 w-4 fill-primary text-primary"
              : "h-4 w-4 text-border"
          }
        />
      ))}
    </div>
  );
}

export function GoogleReviews() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
        What our customers say
      </h2>

      <div className="mt-10 flex flex-col gap-4 rounded-2xl bg-muted p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Google Reviews
          </span>
          <span className="font-display text-2xl font-semibold">
            {googleReviews.rating.toFixed(1)}
          </span>
          <StarRating rating={googleReviews.rating} />
          <span className="text-sm text-muted-foreground">
            ({googleReviews.reviewCount})
          </span>
        </div>
        <a
          href={googleReviews.writeReviewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Review us on Google
        </a>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {googleReviews.featured.map((review, i) => (
          <div key={i} className="rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {review.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{review.name}</p>
                <StarRating rating={5} />
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {review.quote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
