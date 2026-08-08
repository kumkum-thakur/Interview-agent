import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interview Agent",
  description: "Personalized technical interviews powered by cohort history + Breeth memory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
