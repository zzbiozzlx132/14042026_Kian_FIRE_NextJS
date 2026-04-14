"use client";

import { Header } from "@/components/layout/header";
import { UserCircle, Shield, List, Bell, Link2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Cài Đặt</h1>
        <p className="text-sm text-[var(--text-muted)]">Quản lý hạng mục, ngân sách, và cấu hình hệ thống Kian FIRE</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 border-r border-[var(--border)] pr-4 space-y-1">
             <button className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--accent-muted)] text-[var(--accent)] font-semibold rounded-xl text-sm">
                 <UserCircle size={18} />
                 Tài khoản
             </button>
             <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium rounded-xl text-sm transition-colors cursor-not-allowed">
                 <List size={18} />
                 Hạng mục
             </button>
             <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium rounded-xl text-sm transition-colors cursor-not-allowed">
                 <Shield size={18} />
                 AI Ngân sách
             </button>
             <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium rounded-xl text-sm transition-colors cursor-not-allowed">
                 <Link2 size={18} />
                 Telegram Bot
             </button>
          </div>

          <div className="md:col-span-3">
              <div className="card">
                  <h3 className="section-label mb-6">Thông tin Admin</h3>
                  
                  <div className="space-y-6">
                      <div className="form-group">
                          <label className="form-label">Tên hiển thị</label>
                          <input type="text" className="input max-w-md" defaultValue="Kian" disabled />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Email đăng nhập</label>
                          <input type="email" className="input max-w-md" defaultValue="kian@example.com" disabled />
                      </div>
                      <div className="pt-4 border-t border-[var(--border)]">
                          <label className="form-label mb-2">Đổi mật khẩu</label>
                          <button className="btn btn-ghost text-sm py-2">
                             Yêu cầu đổi mật khẩu
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
