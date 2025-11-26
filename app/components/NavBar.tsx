"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

export default function NavBar({ session }: { session?: any }) {
  const pathname = usePathname();
  const router = useRouter();

  // Safe fallbacks
  const username = session?.username ?? session?.name ?? "User";
  const roleLevel = Number(session?.permissions_level ?? 0);
  const role = session?.role?.toLowerCase?.() ?? "";

  // Role checks
  const isManagerOrAbove = roleLevel >= 800; // manager, admin, owner
  const isManager = role === "manager";
  const isAdmin = role === "admin";
  const isOwner = role === "owner";
  const isAdminOrOwner = isAdmin || isOwner;

  // Logout handler
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Base tabs (no dropdown items)
  const tabs = [
    { name: "POS", href: "/pos" },
    { name: "Timesheet", href: "/timesheet" },

    { name: "Customers", href: "/customers" },
    { name: "Items", href: "/items" },
    { name: "Tabs", href: "/tabs" },
    { name: "Categories", href: "/categories" },
    { name: "Discounts", href: "/discounts" },

    // Staff always visible for manager+
    ...(isManagerOrAbove ? [{ name: "Staff", href: "/staff" }] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 w-full bg-slate-900 border-b border-slate-800 z-50">
      <div className="flex items-center justify-between px-6 py-3">

        {/* LOGO + TITLE */}
        <div className="flex items-center gap-3">
          <Image src="/logo.png" width={42} height={42} alt="logo" />
          <h1 className="text-xl font-bold">Galaxy Nightclub POS</h1>
        </div>

        {/* NAVIGATION */}
        <div className="flex items-center gap-6">

          {/* STANDARD NAV TABS */}
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition
                  ${
                    active
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
              >
                {tab.name}
              </Link>
            );
          })}

          {/* STAFF MANAGEMENT DROPDOWN (Admin, Owner, Manager) */}
          {isManagerOrAbove && (
            <div className="relative group">

              {/* BUTTON */}
              <button
                className={`px-3 py-2 text-sm font-medium rounded-md transition 
                  ${
                    pathname.startsWith("/settings") ||
                    pathname.startsWith("/payments") ||
                    pathname.startsWith("/reports")
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
              >
                Staff Management ▾
              </button>

              {/* DROPDOWN — ALWAYS TOUCHING BUTTON (top-full), NO GAP */}
              <div className="
                absolute left-0 top-full 
                w-44 
                bg-slate-800 
                border border-slate-700 
                rounded-md shadow-lg 
                py-2 
                z-50 
                hidden 
                group-hover:block
                pt-1
              ">

                {/* MANAGER: Payments ONLY */}
                {isManager && (
                  <Link
                    href="/payments"
                    className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    Payments
                  </Link>
                )}

                {/* ADMIN + OWNER: Full access */}
                {isAdminOrOwner && (
                  <>
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

        {/* USER INFO + LOGOUT */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-slate-400 leading-none">Logged in as:</p>
            <p className="font-semibold capitalize leading-none">{username}</p>
            <p className="text-slate-500 text-xs capitalize">({role})</p>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium transition"
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}
