import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUCL Admin",
  description: "Admin console for LUCL"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
