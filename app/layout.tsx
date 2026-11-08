import type { Metadata } from "next";
import { Karla } from "next/font/google";
import { BottomNav } from "./components/BottomNav";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Herd",
  description: "Rank concerts by comparing the shows you have seen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${karla.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
