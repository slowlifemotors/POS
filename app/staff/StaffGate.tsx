//  app/staff/StaffGate.tsx
"use client";

import { useState, useEffect } from "react";

export default function StaffGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const granted = localStorage.getItem("staff_access_granted");
    if (granted === "true") setAllowed(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pwd === process.env.NEXT_PUBLIC_STAFF_ACCESS_PASSWORD) {
      localStorage.setItem("staff_access_granted", "true");
      setAllowed(true);
    } else {
      setError("Incorrect password.");
    }
  };

  if (allowed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm"
      >
        <h2 className="text-xl font-bold mb-4">🔒 Enter Staff Password</h2>

        {error && <p className="text-red-400 mb-2">{error}</p>}

        <input
          type="password"
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg mb-4"
          placeholder="Password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white py-3 rounded-lg"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
