// app/settings/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

export default async function SettingsPage() {
  const session = await getSession();

  // Not logged in → login
  if (!session?.staff) {
    redirect("/login");
  }

  const role = roleLower(session.staff.role);
  const permissions = session.staff.permissions_level ?? 0;

  // Optional: restrict settings to manager+
  if (permissions < 800) {
    redirect("/pos");
  }

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">
            Manage business configuration and system rules.
          </p>
        </div>

        {/* SETTINGS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* COMMISSION */}
          <Link
            href="/settings/commission"
            className="block bg-slate-900 border border-slate-700 rounded-xl p-6 hover:bg-slate-800 transition"
          >
            <h2 className="text-xl font-bold text-white mb-2">
              Commission & Pay
            </h2>
            <p className="text-slate-400 text-sm">
              Set commission percentages, hourly rates, and staff discount rules.
            </p>
          </Link>

          {/* BUSINESS */}
          <Link
            href="/settings/business"
            className="block bg-slate-900 border border-slate-700 rounded-xl p-6 hover:bg-slate-800 transition"
          >
            <h2 className="text-xl font-bold text-white mb-2">
              Business Settings
            </h2>
            <p className="text-slate-400 text-sm">
              Branding, logo, business name, and theme configuration.
            </p>
          </Link>

          {/* STAFF (if you had it) */}
          <Link
            href="/staff"
            className="block bg-slate-900 border border-slate-700 rounded-xl p-6 hover:bg-slate-800 transition"
          >
            <h2 className="text-xl font-bold text-white mb-2">
              Staff Management
            </h2>
            <p className="text-slate-400 text-sm">
              Add, edit, activate, or deactivate staff accounts.
            </p>
          </Link>

          {/* OPTIONAL PLACEHOLDER */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 opacity-60">
            <h2 className="text-xl font-bold text-white mb-2">
              More Settings
            </h2>
            <p className="text-slate-400 text-sm">
              Additional system options can live here later.
            </p>
          </div>
        </div>

        {/* FOOTER INFO */}
        <div className="mt-10 text-xs text-slate-500">
          Logged in as <span className="text-slate-300">{session.staff.username}</span>{" "}
          ({role})
        </div>
      </div>
    </div>
  );
}
