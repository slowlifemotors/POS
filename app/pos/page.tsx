// app/pos/page.tsx
"use client";

import POSClient from "./POSClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function POSPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${window.location.origin}/api/auth/session`, {
        method: "GET",
        credentials: "include",
      });

      const session = await res.json();

      if (!session.staff) {
        router.push("/login");
        return;
      }

      setStaff(session.staff);
    }

    load();
  }, [router]);

  if (!staff) return null;

  return <POSClient staffId={staff.id} staffName={staff.username} />;
}
