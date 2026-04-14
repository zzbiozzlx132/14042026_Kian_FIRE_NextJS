"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Plus, Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, Diamond } from "lucide-react";
import { fmtMoney, fmtMoneyCompact } from "@/lib/utils";

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tài sản & Đầu tư</h1>
        <button className="btn btn-primary">
          <Plus size={18} /> Thêm mới
        </button>
      </div>

      <div className="tab-bar inline-flex">
        <button 
          onClick={() => setActiveTab("accounts")} 
          className={`tab-item flex items-center gap-2 ${activeTab === "accounts" ? "active" : ""}`}
        >
          <Wallet size={16} /> Tài khoản/Ví
        </button>
        <button 
          onClick={() => setActiveTab("investments")} 
          className={`tab-item flex items-center gap-2 ${activeTab === "investments" ? "active" : ""}`}
        >
          <TrendingUp size={16} /> Đầu tư
        </button>
        <button 
          onClick={() => setActiveTab("debts")} 
          className={`tab-item flex items-center gap-2 ${activeTab === "debts" ? "active" : ""}`}
        >
          <ArrowDownRight size={16} /> Vay / Nợ
        </button>
        <button 
          onClick={() => setActiveTab("physical")} 
          className={`tab-item flex items-center gap-2 ${activeTab === "physical" ? "active" : ""}`}
        >
          <Diamond size={16} /> Tài sản vật lý
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "accounts" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-5 group hover:border-[var(--info)] transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Wallet size={20} />
                  </div>
                  <span className="badge badge-info">Chính</span>
                </div>
                <h3 className="font-semibold mb-1">Ví Tiền Mặt</h3>
                <div className="text-2xl font-bold">{fmtMoney(2500000)}</div>
                <p className="text-xs text-[var(--text-muted)] mt-4">Cập nhật lúc nãy</p>
              </div>

               <div className="card p-5 group hover:border-[#8B5CF6] transition-colors relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Wallet size={20} />
                  </div>
                  <span className="badge border border-[#8B5CF6]/30 text-[#8B5CF6] text-[10px]">Thẻ Tín Dụng</span>
                </div>
                <h3 className="font-semibold mb-1">Timo Visa</h3>
                <div className="text-2xl font-bold text-[var(--danger)]">-{fmtMoney(4500000)}</div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-between items-center">
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Hạn mức</span>
                  <span className="text-sm font-semibold">{fmtMoneyCompact(50000000)}</span>
                </div>
              </div>
            </div>
        )}

        {/* Mocks for Investments, Debts, Physical just display placeholders indicating readiness */}
        {activeTab !== "accounts" && (
            <div className="card min-h-[300px] flex items-center justify-center border-dashed">
                <div className="text-[var(--text-muted)] font-medium text-center">
                    Cấu trúc API cho {activeTab} đã sẵn sàng. <br /> Sẽ đổ dữ liệu thực từ Database sau khi bật hệ thống chạy.
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
