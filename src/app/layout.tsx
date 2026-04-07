import type { Metadata } from "next";
import { Chewy } from "next/font/google";
import "./globals.css";

const chewy = Chewy({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://bored-game-29qq12xe1-milesmanos-projects.vercel.app"),
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={chewy.className}>{children}</body>
    </html>
  );
}
