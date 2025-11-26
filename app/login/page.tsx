// app/login/page.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${window.location.origin}/api/auth/login`, {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl">

        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.png" width={80} height={80} alt="logo" />
          <h1 className="text-2xl font-bold text-slate-50 mt-3">
            Galaxy Nightclub POS
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
              className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-50 rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-50 rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-semibold transition ${
              loading
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-fuchsia-600 hover:bg-fuchsia-500"
            }`}
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
