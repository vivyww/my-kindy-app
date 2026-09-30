import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Day | Kindergarten classroom",
  description: "A calmer way to care for your classroom, every day.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
