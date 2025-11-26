// app/timesheet/components/LiveTimer.tsx
"use client";

import { useEffect, useState } from "react";

export default function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function update() {
      const start = new Date(startTime).getTime();
      const now = Date.now();

      let diff = Math.floor((now - start) / 1000); // seconds
      const hours = Math.floor(diff / 3600);
      diff %= 3600;
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;

      setElapsed(
        `${hours}h ${minutes}m ${seconds}s`
      );
    }

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-emerald-400 font-semibold">{elapsed}</span>
  );
}
