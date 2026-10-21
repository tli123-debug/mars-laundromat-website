import type { MetadataRoute } from "next";
import { siteConfig } from "@/content/site-config";

const routes = [
  "",
  "/about",
  "/pickup-delivery",
  "/services/wash-and-fold",
  "/services/dry-cleaning",
  "/services/commercial",
  "/contact",
  "/book",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/pickup-delivery" ? 0.9 : 0.7,
  }));
}
