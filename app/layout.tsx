import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import { ThemeProvider } from "./theme-provider";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slowlife Motors POS",
  description: "POS system for Slowlife Motos",
};

async function loadBusinessSettings() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    return {};
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load business settings:", error);
    return {};
  }

  return data || {};
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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

  const settings: any = await loadBusinessSettings();

  const businessName = settings.business_name || "My Business";
  const businessLogo = settings.business_logo_url || "/logo.png";
  const themeColor = settings.theme_color || "#d946ef";
  const logoWidth = settings.logo_width ?? 60;
  const logoHeight = settings.logo_height ?? 60;

  const bgUrl: string | null = settings.background_image_url ?? null;

  const bgOpacityRaw = settings.background_opacity;
  const bgOpacity =
    typeof bgOpacityRaw === "number"
      ? bgOpacityRaw
      : bgOpacityRaw
      ? Number(bgOpacityRaw)
      : 0.12;

  const darkenEnabled = Boolean(settings.background_darken_enabled);
  const darkenStrengthRaw = settings.background_darken_strength;
  const darkenStrength =
    typeof darkenStrengthRaw === "number"
      ? darkenStrengthRaw
      : darkenStrengthRaw
      ? Number(darkenStrengthRaw)
      : 0.35;

  const safeOpacity = Number.isFinite(bgOpacity) ? Math.min(Math.max(bgOpacity, 0), 1) : 0.12;
  const safeDarkness = Number.isFinite(darkenStrength)
    ? Math.min(Math.max(darkenStrength, 0), 1)
    : 0.35;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}>
        <ThemeProvider themeColor={themeColor} />

        {/* GLOBAL BACKGROUND (never blocks mouse, always behind) */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          {/* image layer */}
          {bgUrl ? (
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{
                backgroundImage: `url("${bgUrl}")`,
                opacity: safeOpacity,
              }}
            />
          ) : null}

          {/* optional darken overlay */}
          {darkenEnabled ? (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: safeDarkness }}
            />
          ) : null}
        </div>

        {navSession && (
          <NavBar
            session={navSession}
            businessName={businessName}
            businessLogo={businessLogo}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
          />
        )}

        {/* main content always above background */}
        <main className="min-h-screen pt-20 relative z-0">{children}</main>
      </body>
    </html>
  );
}
