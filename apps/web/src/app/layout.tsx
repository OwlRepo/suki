import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = "https://suki.tyvera.app";

const siteTitle =
  "Suki | Automated Customer Follow-Ups for Service Businesses";

const siteDescription =
  "Reduce no-shows and bring customers back automatically. Suki sends appointment reminders, missed-visit recovery messages, and customer follow-ups for salons, clinics, spas, gyms, and other service businesses.";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Suki",
      url: siteUrl,
      description: siteDescription,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "Suki",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description: siteDescription,
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Service businesses with repeat customers",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  applicationName: "Suki",

  title: {
    default: siteTitle,
    template: "%s | Suki",
  },

  description: siteDescription,

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    shortcut: "/favicon.ico",
  },

  manifest: "/manifest.webmanifest",

  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Suki",
    title: siteTitle,
    description: siteDescription,
    locale: "en_PH",
  },

  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  category: "business software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}