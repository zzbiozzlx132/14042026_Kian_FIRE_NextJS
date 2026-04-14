"use client";

import { WAKE_UP_QUOTES } from "@/lib/constants";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export function Header({ userName }: { userName: string }) {
  const [quote, setQuote] = useState(WAKE_UP_QUOTES[0]);
  const today = format(new Date(), "EEEE, dd MMMM, yyyy", { locale: vi });

  useEffect(() => {
    // Random quote mỗi lần load
    setQuote(WAKE_UP_QUOTES[Math.floor(Math.random() * WAKE_UP_QUOTES.length)]);
  }, []);

  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold mb-1 tracking-tight">
        Chào mừng trở lại, {userName?.split(" ")[0]}
      </h1>
      <p className="text-[var(--text-muted)] text-[12px] font-semibold uppercase tracking-wider mb-4">
        {today}
      </p>
      
      <div className="card-glass border-l-4 border-l-[var(--accent)] py-3 px-4 flex items-center bg-gradient-to-r from-[var(--accent-muted)] to-transparent">
        <p className="text-[13px] font-medium italic text-[var(--accent)]">
          "{quote}"
        </p>
      </div>
    </div>
  );
}
