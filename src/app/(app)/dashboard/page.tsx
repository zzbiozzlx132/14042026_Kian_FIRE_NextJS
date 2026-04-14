"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { fmtMoney, fmtMoneyCompact, fmtDate } from "@/lib/utils";
import { Wallet, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight, Activity, ReceiptText } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  totalCredit: number;
  totalInvest: number;
  monthlyIncome: number;
  monthlyExpense: number;
  recentTransactions: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const d = data || {
    netWorth: 0, totalAssets: 0, totalDebt: 0, totalCredit: 0,
    totalInvest: 0, monthlyIncome: 0, monthlyExpense: 0, recentTransactions: []
  };

  const month = new Date().getMonth() + 1;

  return (
    <div className="animate-in fade-in duration-500">
      <Header userName="Kian" />

      {/* Hero: Net Worth */}
      <div className="card-glass overflow-hidden relative mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="section-label flex items-center gap-2">
              <Activity size={14} className="text-[var(--accent)]" /> Tổng tài sản ròng
            </div>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tighter">
              {loading ? <div className="skeleton h-12 w-64"></div> : fmtMoney(d.netWorth)}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-[var(--bg-input)] px-4 py-3 rounded-xl min-w-[140px]">
              <div className="text-xs text-[var(--text-muted)] font-semibold mb-1 uppercase tracking-wider">Tài sản hiện có</div>
              <div className="text-lg font-bold text-[var(--success)]">
                {loading ? "..." : `+${fmtMoneyCompact(d.totalAssets)}`}
              </div>
            </div>
            <div className="bg-[var(--bg-input)] px-4 py-3 rounded-xl min-w-[140px]">
              <div className="text-xs text-[var(--text-muted)] font-semibold mb-1 uppercase tracking-wider">Tổng nợ & thẻ</div>
              <div className="text-lg font-bold text-[var(--danger)]">
                {loading ? "..." : `-${fmtMoneyCompact(d.totalDebt)}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ArrowDownRight} label={`Thu nhập T${month}`} value={d.monthlyIncome} color="success" loading={loading} />
        <StatCard icon={ArrowUpRight} label={`Chi tiêu T${month}`} value={d.monthlyExpense} color="danger" loading={loading} />
        <StatCard icon={CreditCard} label="Nợ thẻ tín dụng" value={d.totalCredit} color="info" loading={loading} />
        <StatCard icon={TrendingUp} label="Tổng đầu tư" value={d.totalInvest} color="accent" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart placeholder */}
        <div className="card lg:col-span-2 min-h-[280px] flex flex-col items-center justify-center border-dashed border-[var(--border)]">
          <p className="text-[var(--text-muted)] text-sm font-medium">Biểu đồ thu chi theo tháng</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">(Sẽ hiển thị khi có dữ liệu giao dịch)</p>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="section-label">Giao dịch gần nhất</div>
          {d.recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-[var(--bg-input)] rounded-xl flex items-center justify-center mx-auto mb-3 text-[var(--text-muted)]">
                <ReceiptText size={20} />
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-3">Chưa có giao dịch nào</p>
              <Link href="/transactions/new" className="text-[var(--accent)] text-sm font-semibold hover:underline">
                + Thêm giao dịch đầu tiên
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {d.recentTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center gap-3 p-2 hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    tx.type === "INCOME" ? "bg-[var(--success-bg)] text-[var(--success)]" :
                    tx.type === "EXPENSE" ? "bg-[var(--danger-bg)] text-[var(--danger)]" :
                    "bg-[var(--info-bg)] text-[var(--info)]"
                  }`}>
                    {tx.type === "INCOME" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium truncate">{tx.description || tx.category?.name || "Giao dịch"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{fmtDate(tx.date)}</div>
                  </div>
                  <div className={`text-sm font-bold ${tx.type === "INCOME" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {tx.type === "INCOME" ? "+" : "-"}{fmtMoneyCompact(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/transactions" className="block w-full mt-4 btn btn-ghost py-2 text-xs text-center">
            Xem tất cả
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, loading }: {
  icon: any; label: string; value: number; color: string; loading: boolean;
}) {
  const colorMap: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    danger: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    accent: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  };

  return (
    <div className="card group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold">
        {loading ? <div className="skeleton h-6 w-20"></div> : fmtMoneyCompact(value)}
      </div>
    </div>
  );
}
