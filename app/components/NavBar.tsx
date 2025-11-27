// app/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

export default function NavBar({
  session,
  businessName,
  businessLogo,
  logoWidth = 60,
  logoHeight = 60,
}: {
  session?: any;
  businessName: string;
  businessLogo: string;
  logoWidth?: number;
  logoHeight?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const username = session?.username ?? session?.name ?? "User";
  const roleLevel = Number(session?.permissions_level ?? 0);
  const role = session?.role?.toLowerCase?.() ?? "";

  const isManagerOrAbove = roleLevel >= 800;
  const isAdmin = role === "admin";
  const isOwner = role === "owner";
  const isAdminOrOwner = isAdmin || isOwner;

  const [logoSrc, setLogoSrc] = useState(businessLogo || "/logo.png");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const tabs = [
    { name: "POS", href: "/pos" },
    { name: "Timesheet", href: "/timesheet" },
    { name: "Customers", href: "/customers" },
    { name: "Items", href: "/items" },
    { name: "Tabs", href: "/tabs" },
    { name: "Categories", href: "/categories" },
    { name: "Discounts", href: "/discounts" },
    { name: "Staff", href: "/staff" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full bg-slate-900 border-b border-slate-800 z-50 shadow-md">
      <div className="flex items-center justify-between px-6 py-3">
        
        {/* BUSINESS LOGO + NAME */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: logoWidth, height: logoHeight }}
            className="flex items-center justify-center overflow-hidden rounded-md"
          >
            <Image
              src={logoSrc}
              width={logoWidth}
              height={logoHeight}
              alt="Logo"
              className="object-contain"
              onError={() => setLogoSrc("/logo.png")}
            />
          </div>

          <h1 className="text-xl font-bold">{businessName}</h1>
        </div>

        {/* NAVIGATION */}
        <div className="flex items-center gap-6">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                  active
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}

          {/* STAFF MANAGEMENT DROPDOWN */}
          {isManagerOrAbove && (
            <div className="relative group">
              <button
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                  pathname.startsWith("/settings") ||
                  pathname.startsWith("/payments") ||
                  pathname.startsWith("/reports") ||
                  pathname.startsWith("/live") ||
                  pathname.startsWith("/sales")
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                Staff Management ▾
              </button>

              <div className="absolute left-0 top-full w-44 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-2 hidden group-hover:block">
                {isAdminOrOwner && (
                  <>
                    <Link
                      href="/live"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Live
                    </Link>

                    <Link
                      href="/sales"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Sales
                    </Link>

                    <Link
                      href="/settings/commission"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Commission
                    </Link>

                    <Link
                      href="/payments"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Payments
                    </Link>

                    <Link
                      href="/reports"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Reports
                    </Link>

                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Settings
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* USER INFO */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right leading-tight">
            <p className="text-slate-400">Logged in as:</p>
            <p className="font-semibold capitalize">{username}</p>
            <p className="text-slate-500 text-xs capitalize">({role})</p>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
