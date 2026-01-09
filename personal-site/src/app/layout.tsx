import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { BackgroundCanvas } from "@/components/background-canvas";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vitor",
  description: "software engineer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`}>
        <BackgroundCanvas />
        {children}
      </body>
    </html>
  );
}
