import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MainLayout } from "@/components/layout/main-layout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Poseidon Ledger — Maritime Intelligence",
  description:
    "Maritime intelligence & ESG compliance platform for fleet monitoring, document management, and operational oversight.",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans antialiased">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
