// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import { getSession } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Galaxy Nightclub POS",
  description: "POS system for Galaxy Nightclub",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  const navSession = session?.staff
    ? {
        id: session.staff.id,
        name: session.staff.name,
        username: session.staff.username,
        role: session.staff.role,
        permissions_level: session.staff.permissions_level,
      }
    : null;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        {navSession && <NavBar session={navSession} />}

        <main className="min-h-screen pt-20">{children}</main>
      </body>
    </html>
  );
}
