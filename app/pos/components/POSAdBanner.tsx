// app/pos/components/POSAdBanner.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Ad = {
  id: number;
  text: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function msUntilNextHalfHour() {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  const minsToNext = minutes < 30 ? 30 - minutes : 60 - minutes;
  return minsToNext * 60_000 - seconds * 1000 - ms;
}

export default function POSAdBanner() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const text = useMemo(() => (ad?.text ?? "").trim(), [ad]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ads/active", { cache: "no-store" });
      const json = await safeJson(res);

      // ✅ don’t wipe current ad on API errors
      if (!res.ok) {
        console.error("Failed to load active ad:", json?.error || res.statusText);
        return;
      }

      setAd(json?.ad ?? null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Staff manual refresh: pick a random enabled ad immediately
  const manualRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      const res = await fetch("/api/ads/random", { cache: "no-store" });
      const json = await safeJson(res);

      // ✅ don’t wipe current ad on API errors
      if (!res.ok) {
        console.error("Failed to refresh ad:", json?.error || res.statusText);
        return;
      }

      setAd(json?.ad ?? null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const setup = async () => {
      await load();

      const firstDelay = msUntilNextHalfHour();

      timeoutRef.current = setTimeout(async () => {
        await load();
        intervalRef.current = setInterval(load, 30 * 60_000);
      }, firstDelay);
    };

    setup();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className="mb-1 rounded-xl border border-slate-700 bg-slate-900/70 py-2 px-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-0">
            Advertisement
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : !text ? (
            <div className="text-slate-500 text-sm">No active advertisements.</div>
          ) : (
            <div className="text-slate-100 font-semibold whitespace-pre-wrap break-words">
              {text}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={copy}
            disabled={!text}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-semibold hover:bg-slate-700 disabled:bg-slate-800/40 disabled:text-slate-500 disabled:border-slate-800"
          >
            {copied ? "Copied!" : "Copy"}
          </button>

          <button
            type="button"
            onClick={manualRefresh}
            disabled={loading || refreshing}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed"
            title="Pick another active ad now"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
