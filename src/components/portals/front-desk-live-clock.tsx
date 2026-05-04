"use client";

import { useEffect, useState } from "react";

export function FrontDeskLiveClock({ initialIso }: { initialIso: string }) {
  const [now, setNow] = useState(() => new Date(initialIso));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div>
      <p className="font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)] md:text-[40px]">
        {new Intl.DateTimeFormat("en-NG", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(now)}
      </p>
      <p className="mt-1 font-[var(--font-mono)] text-[16px] text-[var(--color-text-secondary)] md:text-[18px]">
        {new Intl.DateTimeFormat("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(now)}
      </p>
    </div>
  );
}
