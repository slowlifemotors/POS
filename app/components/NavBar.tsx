// app/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useState } from "react";

type NavSession = {
  id?: number;
  name?: string;
  username?: string;
  role?: string;
  permissions_level?: number;
};

type NavItem = {
  label: string;
  href?: string;
  items?: { label: string; href: string }[];
  activeMatch?: string[];
  hide?: boolean;
};

export default function NavBar({
  session,
  businessName,
  businessLogo,
  logoWidth = 60,
  logoHeight = 60,
}: {
  session?: NavSession | any;
  businessName: string;
  businessLogo: string;
  logoWidth?: number;
  logoHeight?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const username = session?.username ?? session?.name ?? "User";
  const role = session?.role?.toLowerCase?.() ?? "";

  const isAdmin = role === "admin";
  const isOwner = role === "owner";
  const isManager = role === "manager";

  // Management dropdown only for admin/owner/manager
  const canAccessManagement = isAdmin || isOwner || isManager;

  const [logoSrc, setLogoSrc] = useState(businessLogo || "/logo.png");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navItems: NavItem[] = useMemo(() => {
    return [
      { label: "POS", href: "/pos", activeMatch: ["/pos"] },

      { label: "Customers", href: "/customers", activeMatch: ["/customers"] },

      {
        label: "Staff",
        // ✅ Staff List moved here and visible to ALL roles
        items: [
          { label: "Staff List", href: "/staff" },
          { label: "Timesheet", href: "/timesheet" },
          { label: "Calendar", href: "/timesheet/calendar" },
        ],
        activeMatch: ["/staff", "/timesheet"],
      },

      {
        label: "Management",
        hide: !canAccessManagement,
        items: [
          // ✅ Removed /staff from Management
          { label: "Vehicles", href: "/items" },
          { label: "Live Staff", href: "/live" },
          { label: "Sales Log", href: "/sales" },
          { label: "Commission Settings", href: "/settings/commission" },
          { label: "Pays", href: "/payments" },
          { label: "Discounts", href: "/discounts" },
          { label: "Settings", href: "/settings" },
        ],
        activeMatch: [
          "/items",
          "/live",
          "/sales",
          "/settings/commission",
          "/payments",
          "/discounts",
          "/settings",
        ],
      },
    ];
  }, [canAccessManagement]);

  const isActive = (matches?: string[]) =>
    matches?.some((m) => pathname.startsWith(m)) ?? false;

  return (
    // ✅ isolate + z-index ensures dropdowns stay above backdrop-blur stacking contexts
    <nav className="fixed top-0 left-0 w-full bg-slate-900 border-b border-slate-800 shadow-md z-[1000] isolate">
      <div className="flex items-center justify-between px-6 py-3">
        {/* LOGO + BUSINESS NAME */}
        <div className="flex items-center gap-3 min-w-[260px]">
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

        {/* NAV */}
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            if (item.hide) return null;

            const active = isActive(item.activeMatch);

            if (item.items) {
              return (
                <div key={item.label} className="relative group">
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      active
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {item.label} ▾
                  </button>

                  {/* Dropdown */}
                  <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-[1100]">
                    <div className="w-52 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-2">
                      {item.items.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`block px-4 py-2 text-sm ${
                            pathname.startsWith(sub.href)
                              ? "bg-slate-700 text-white"
                              : "text-slate-300 hover:bg-slate-700 hover:text-white"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href!}
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                  active
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* USER / LOG OUT */}
        <div className="flex items-center gap-4 text-sm min-w-[220px] justify-end">
          <div className="text-right leading-tight">
            <p className="text-slate-400">Name</p>
            <p className="font-semibold capitalize">{username}</p>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white"
          >
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}
