// app/staff/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Not logged in
  if (!session?.staff) {
    redirect("/login");
  }

  const lvl = Number(session.staff.permissions_level ?? 0);

  // Must be Manager (800) / Admin (900) / Owner (1000)
  if (lvl < 800) {
    redirect("/pos");
  }

  // Allow page to render inside RootLayout
  return <>{children}</>;
}
