"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ReceiptText, Wallet, Target, Settings, Plus } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const LEFT_ITEMS = [
    { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
    { label: "Giao dịch", href: "/transactions", icon: ReceiptText },
  ];

  const RIGHT_ITEMS = [
    { label: "Tài sản", href: "/assets", icon: Wallet },
    { label: "Mục tiêu", href: "/goals", icon: Target },
  ];

  return (
    <nav className="bottom-nav">
      {LEFT_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "bottom-nav-item",
            (pathname === item.href || pathname.startsWith(`${item.href}/`)) && "active"
          )}
        >
          <item.icon size={22} className="mb-1" />
          <span className="truncate max-w-[64px] text-center">{item.label}</span>
        </Link>
      ))}

      {/* Center FAB — perfectly centered */}
      <Link 
        href="/transactions/new"
        className="flex items-center justify-center w-12 h-12 -mt-6 bg-[var(--accent)] text-white rounded-full shadow-lg border-4 border-[var(--bg-card)] shrink-0 hover:scale-110 active:scale-95 transition-transform"
      >
        <Plus size={24} />
      </Link>

      {RIGHT_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "bottom-nav-item",
            (pathname === item.href || pathname.startsWith(`${item.href}/`)) && "active"
          )}
        >
          <item.icon size={22} className="mb-1" />
          <span className="truncate max-w-[64px] text-center">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
