"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, LayoutDashboard, ReceiptText, Wallet, Target, Settings, Flame } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const NAV_ITEMS = [
    { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
    { label: "Giao dịch", href: "/transactions", icon: ReceiptText },
    { label: "Tài sản", href: "/assets", icon: Wallet },
    { label: "Mục tiêu", href: "/goals", icon: Target },
    { label: "Cài đặt", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-10 mt-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
          <Flame size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-bold text-lg leading-tight tracking-tight text-[var(--text-primary)]">Kian FIRE</div>
          <div className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">v3.0 Premium</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-item group", isActive && "active")}
            >
              <Icon
                size={20}
                className={cn(
                  "nav-icon transition-colors",
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Theme */}
      <div className="mt-auto pt-6 border-t border-[var(--border)]">
        <div className="flex items-center justify-between px-2 mb-6">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Giao diện tối</span>
          <Switch 
            checked={theme === "dark"} 
            onCheckedChange={toggleTheme} 
          />
        </div>

        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-muted)] flex items-center justify-center font-bold text-[var(--accent)]">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-semibold truncate text-[var(--text-primary)]">{user?.name}</div>
            <div className="text-xs text-[var(--text-muted)] truncate">{user?.role}</div>
          </div>
        </div>
        
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-4 py-2 text-[12px] text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-xl transition-colors font-semibold uppercase tracking-wider"
        >
          <LogOut size={16} />
          Đăng xuất
        </button>

        <div className="mt-4 pt-4 border-t border-[var(--border)] text-center">
          <a href="https://kiantr.com" target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
            kiantran
          </a>
        </div>
      </div>
    </aside>
  );
}
