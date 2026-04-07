import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bored game",
  description: "are you bored",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "bored game",
    description: "are you bored",
    siteName: "bored game",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "bored game",
    description: "are you bored",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Chewy&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
