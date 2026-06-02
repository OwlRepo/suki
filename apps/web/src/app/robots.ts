import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/customers/",
        "/appointments/",
        "/insights/",
        "/settings/",
      ],
    },
    sitemap: "https://tyvera.app/sitemap.xml",
    host: "https://tyvera.app",
  };
}