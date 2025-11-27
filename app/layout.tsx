// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import { ThemeProvider } from "./theme-provider";
import { getSession } from "@/lib/auth";

// -------------------------------
// FONTS
// -------------------------------
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// -------------------------------
// METADATA
// -------------------------------
export const metadata: Metadata = {
  title: "Galaxy Nightclub POS",
  description: "POS system for Galaxy Nightclub",
};

// -------------------------------
// SAFE BASE URL (LOCAL + VERCEL)
// -------------------------------
function getBaseURL() {
  // If NEXT_PUBLIC_BASE_URL exists → always preferred
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // If deployed on Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local fallback
  return "http://localhost:3000";
}

// -------------------------------
// LOAD BUSINESS SETTINGS
// -------------------------------
async function loadBusinessSettings() {
  const base = getBaseURL();

  const res = await fetch(`${base}/api/settings/business`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to load business settings:", await res.text());
    return {};
  }

  const json = await res.json();
  return json.settings || {};
}

// -------------------------------
// ROOT LAYOUT
// -------------------------------
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load session
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

  // Load business settings
  const settings = await loadBusinessSettings();

  const businessName = settings.business_name || "My Business";
  const businessLogo = settings.business_logo_url || "/logo.png";
  const themeColor = settings.theme_color || "#d946ef";

  const logoWidth = settings.logo_width ?? 60;
  const logoHeight = settings.logo_height ?? 60;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        <ThemeProvider themeColor={themeColor} />

        {navSession && (
          <NavBar
            session={navSession}
            businessName={businessName}
            businessLogo={businessLogo}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
          />
        )}

        <main className="min-h-screen pt-20">{children}</main>
      </body>
    </html>
  );
}
