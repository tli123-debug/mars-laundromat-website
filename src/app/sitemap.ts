import type { MetadataRoute } from "next";
import { siteConfig } from "@/content/site-config";

const routes = ["", "/about", "/services", "/contact", "/book"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
