// app/login/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type BusinessSettings = {
  business_name: string;
  business_logo_url: string | null;
  theme_color: string;
  logo_width: number | null;
  logo_height: number | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Brand settings (logo/title)
  const [businessName, setBusinessName] = useState("Slowlife Motors POS");
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
  const [logoWidth, setLogoWidth] = useState<number>(80);
  const [logoHeight, setLogoHeight] = useState<number>(80);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      try {
        const res = await fetch("/api/settings/business", { cache: "no-store" });
        const json = await res.json();

        const st: BusinessSettings | undefined = json?.settings;
        if (!st || cancelled) return;

        setBusinessName(
          typeof st.business_name === "string" && st.business_name.trim()
            ? st.business_name
            : "Slowlife Motors POS"
        );

        // Use configured logo if present, otherwise fallback to local
        const url =
          typeof st.business_logo_url === "string" && st.business_logo_url.trim()
            ? st.business_logo_url
            : "/logo.png";
        setLogoUrl(url);

        // Use configured dimensions, otherwise fallback defaults
        const w =
          typeof st.logo_width === "number" && Number.isFinite(st.logo_width)
            ? Math.max(10, Math.min(400, st.logo_width))
            : 80;

        const h =
          typeof st.logo_height === "number" && Number.isFinite(st.logo_height)
            ? Math.max(10, Math.min(400, st.logo_height))
            : 80;

        setLogoWidth(w);
        setLogoHeight(h);
      } catch {
        // Non-fatal: keep defaults
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setErrorMsg(result.error || "Invalid username or password.");
        setLoading(false);
        return;
      }

      router.push("/pos");
    } catch {
      setErrorMsg("Server error. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-6">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div
            className="flex items-center justify-center"
            style={{ width: logoWidth, height: logoHeight }}
          >
            <Image
              src={logoUrl}
              width={logoWidth}
              height={logoHeight}
              alt="logo"
              priority
              className="object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-slate-50 mt-3">
            {businessName}
          </h1>
        </div>

        {errorMsg && (
          <div className="mb-4 text-red-400 text-center">{errorMsg}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-300 mb-1">Username</label>
            <input
              type="text"
              className="w-full p-3 bg-slate-800/80 border border-slate-700 text-slate-50 rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 bg-slate-800/80 border border-slate-700 text-slate-50 rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-semibold transition ${
              loading
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]"
            }`}
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
