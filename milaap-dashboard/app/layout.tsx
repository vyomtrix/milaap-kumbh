import type { Metadata } from "next";
import { Poppins, Tiro_Devanagari_Hindi } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const tiroDevanagari = Tiro_Devanagari_Hindi({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Milaap — Kumbh Mela Safety",
  description:
    "AI-powered missing person detection & reunification system for Kumbh Mela pilgrims",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${tiroDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
