//app/settings/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Staff = {
  id: number;
  name: string;
  username: string;
  role: string;
  permissions_level: number;
};

type BusinessSettings = {
  business_name: string;
  business_logo_url: string | null;
  theme_color: string;
  logo_width: number | null;
  logo_height: number | null;

  background_image_url?: string | null;
  background_opacity?: number | null;

  background_darken_enabled?: boolean | null;
  background_darken_strength?: number | null;
};

function isManagementRole(role: string | undefined | null) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "manager";
}

export default function SettingsPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState("#d946ef");
  const [logoWidth, setLogoWidth] = useState(60);
  const [logoHeight, setLogoHeight] = useState(60);

  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgOpacity, setBgOpacity] = useState<number>(0.12);

  const [bgDarkenEnabled, setBgDarkenEnabled] = useState<boolean>(false);
  const [bgDarkness, setBgDarkness] = useState<number>(0.35);

  useEffect(() => {
    async function load() {
      try {
        const s = await fetch("/api/auth/session").then((r) => r.json());
        setStaff(s.staff || null);

        const bsRes = await fetch("/api/settings/business");
        const bs = await bsRes.json();

        if (bs?.settings) {
          const st: BusinessSettings = bs.settings;

          setBusinessName(st.business_name ?? "");
          setLogoUrl(st.business_logo_url ?? null);
          setThemeColor(st.theme_color ?? "#d946ef");

          setLogoWidth(st.logo_width ?? 60);
          setLogoHeight(st.logo_height ?? 60);

          setBgUrl(st.background_image_url ?? null);

          const op =
            typeof st.background_opacity === "number"
              ? st.background_opacity
              : st.background_opacity
              ? Number(st.background_opacity)
              : 0.12;
          setBgOpacity(Number.isFinite(op) ? op : 0.12);

          setBgDarkenEnabled(Boolean(st.background_darken_enabled));

          const dk =
            typeof st.background_darken_strength === "number"
              ? st.background_darken_strength
              : st.background_darken_strength
              ? Number(st.background_darken_strength)
              : 0.35;
          setBgDarkness(Number.isFinite(dk) ? dk : 0.35);
        } else {
          console.error("Failed to load business settings:", bs);
          alert("Failed to load business settings");
        }
      } catch (err) {
        console.error("Settings load error:", err);
        alert("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );

  if (!staff) return <div className="p-10 text-white">Not authenticated</div>;

  if (!isManagementRole(staff.role))
    return (
      <div className="p-10 text-red-400 text-xl">
        You do not have permission to view this page.
      </div>
    );

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/settings/upload-logo", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok || json.error) {
        alert("Upload failed: " + (json.error || "Unknown error"));
        return;
      }

      const finalUrl =
        typeof json.url === "string"
          ? json.url.includes("?v=")
            ? json.url
            : `${json.url}?v=${Date.now()}`
          : null;

      setLogoUrl(finalUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  }

  async function uploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBg(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/settings/upload-logo?kind=background", {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        alert("Background upload failed: " + (json.error || "Unknown error"));
        return;
      }

      const finalUrl =
        typeof json.url === "string"
          ? json.url.includes("?v=")
            ? json.url
            : `${json.url}?v=${Date.now()}`
          : null;

      setBgUrl(finalUrl);
    } catch (err) {
      console.error("Background upload failed:", err);
      alert("Background upload failed");
    } finally {
      setUploadingBg(false);
      e.currentTarget.value = "";
    }
  }

  async function saveSettings() {
    const res = await fetch("/api/settings/business", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name: businessName,
        business_logo_url: logoUrl,
        theme_color: themeColor,
        logo_width: logoWidth,
        logo_height: logoHeight,

        background_image_url: bgUrl,
        background_opacity: Math.min(Math.max(bgOpacity, 0), 1),

        background_darken_enabled: bgDarkenEnabled,
        background_darken_strength: Math.min(Math.max(bgDarkness, 0), 1),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Save failed:", json);
      return alert("Failed to save");
    }

    alert("Settings saved!");
    router.refresh();
  }

  return (
    <div className="min-h-screen text-white px-8 pt-24 max-w-3xl mx-auto space-y-10">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg backdrop-blur">
        <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
        <p>Name: {staff.name}</p>
        <p>Role: {staff.role}</p>
        <p>Username: {staff.username}</p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg space-y-5 backdrop-blur">
        <h2 className="text-2xl font-bold">Business Settings</h2>

        <div>
          <label className="block text-sm mb-1">Business Name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Accent Colour</label>
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-20 h-10 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm mb-2">Business Logo</label>

          <div className="flex items-center gap-4">
            <div
              className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ width: logoWidth, height: logoHeight }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  width={logoWidth}
                  height={logoHeight}
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <span className="text-slate-500">No Logo</span>
              )}
            </div>

            <div>
              <input type="file" accept="image/*" onChange={uploadLogo} />
              {uploading && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div>
            <label className="block text-sm mb-1">Logo Width (px)</label>
            <input
              type="number"
              value={logoWidth}
              onChange={(e) => setLogoWidth(Number(e.target.value))}
              className="p-2 bg-slate-800 border border-slate-700 rounded w-24"
              min={10}
              max={400}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Logo Height (px)</label>
            <input
              type="number"
              value={logoHeight}
              onChange={(e) => setLogoHeight(Number(e.target.value))}
              className="p-2 bg-slate-800 border border-slate-700 rounded w-24"
              min={10}
              max={400}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-xl font-bold">Background Image</h3>

          <div className="flex items-center gap-4">
            <div className="w-40 h-24 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex items-center justify-center">
              {bgUrl ? (
                <img src={bgUrl} alt="Background preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-500 text-sm">No Background</span>
              )}
            </div>

            <div className="space-y-2">
              <input type="file" accept="image/*" onChange={uploadBackground} />
              {uploadingBg && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}

              <button
                type="button"
                onClick={() => setBgUrl(null)}
                className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
              >
                Remove
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              Background Opacity: {Math.round(Math.min(Math.max(bgOpacity, 0), 1) * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bgOpacity}
              onChange={(e) => setBgOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bgDarkenEnabled}
                onChange={(e) => setBgDarkenEnabled(e.target.checked)}
              />
              Darken background
            </label>

            {bgDarkenEnabled && (
              <div>
                <label className="block text-sm mb-1">
                  Darkness: {Math.round(Math.min(Math.max(bgDarkness, 0), 1) * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={bgDarkness}
                  onChange={(e) => setBgDarkness(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={saveSettings}
          className="px-4 py-2 rounded-lg font-semibold bg-(--accent) hover:bg-(--accent-hover)"
        >
          Save Business Settings
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 text-center backdrop-blur">
        <form action="/api/auth/logout" method="POST">
          <button className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-md font-semibold">
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
