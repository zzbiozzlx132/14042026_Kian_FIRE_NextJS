import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import { fmtMoney, fmtMoneyCompact } from "@/lib/utils";
import { Wallet, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  // Mock data để render layout
  const summary = {
    netWorth: 250000000, // 250M
    totalAssets: 280000000, 
    totalDebt: 300000000, // -30M total debt (just dummy)
    totalCredit: 15000000,
    monthlyIncome: 35000000,
    monthlyExpense: 12500000,
    expenseTrend: -5, // -5% vs last month
  };

  return (
    <div className="animate-in fade-in duration-500">
      <Header userName={session?.user?.name || "Kian"} />

      {/* Hero: Net Worth */}
      <div className="card-glass overflow-hidden relative mb-8 border-[var(--accent-muted)]">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--accent)] opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-[#10b981] opacity-10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="section-label text-[var(--accent)] flex items-center gap-2">
              <Activity size={14} /> Tổng tài sản ròng
            </div>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)]">
              {fmtMoney(summary.netWorth)}
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-[var(--bg-input)] px-4 py-3 rounded-2xl min-w-[140px]">
              <div className="text-xs text-[var(--text-muted)] font-medium mb-1">Tài sản hiện có</div>
              <div className="text-lg font-bold text-[var(--success)]">+{fmtMoneyCompact(summary.totalAssets)}</div>
            </div>
            <div className="bg-[var(--bg-input)] px-4 py-3 rounded-2xl min-w-[140px]">
              <div className="text-xs text-[var(--text-muted)] font-medium mb-1">Tổng nợ & thẻ</div>
              <div className="text-lg font-bold text-[var(--danger)]">-{fmtMoneyCompact(summary.totalDebt + summary.totalCredit)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card hover:border-[var(--success)] group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--success-bg)] flex items-center justify-center text-[var(--success)] group-hover:scale-110 transition-transform">
              <ArrowDownRight size={20} />
            </div>
          </div>
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">Thu nhập T4</div>
          <div className="text-2xl font-bold text-[var(--success)]">{fmtMoneyCompact(summary.monthlyIncome)}</div>
        </div>

        <div className="card hover:border-[var(--danger)] group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--danger-bg)] flex items-center justify-center text-[var(--danger)] group-hover:scale-110 transition-transform">
              <ArrowUpRight size={20} />
            </div>
            <div className="badge badge-success text-[10px] px-2 py-0.5">
              {summary.expenseTrend}%
            </div>
          </div>
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">Chi tiêu T4</div>
          <div className="text-2xl font-bold text-[var(--danger)]">{fmtMoneyCompact(summary.monthlyExpense)}</div>
        </div>

        <div className="card hover:border-[var(--info)] group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--info-bg)] flex items-center justify-center text-[var(--info)] group-hover:scale-110 transition-transform">
              <CreditCard size={20} />
            </div>
          </div>
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">Nợ thẻ tín dụng</div>
          <div className="text-2xl font-bold">{fmtMoneyCompact(summary.totalCredit)}</div>
        </div>

        <div className="card hover:border-[#8B5CF6] group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">Tổng đầu tư</div>
          <div className="text-2xl font-bold">{fmtMoneyCompact(120000000)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Placeholder cho Biểu đồ thu chi */}
        <div className="card lg:col-span-2 min-h-[300px] flex flex-col items-center justify-center border-dashed">
          <p className="text-[var(--text-muted)] text-sm">Biểu đồ thu chi sẽ hiển thị ở đây (Recharts)</p>
          <div className="mt-4 flex gap-2">
            <div className="w-8 h-24 bg-[var(--border)] rounded-t mr-1 animate-pulse"></div>
            <div className="w-8 h-16 bg-[var(--border)] rounded-t animate-pulse"></div>
            <div className="w-8 h-32 bg-[var(--warning-bg)] rounded-t ml-4 animate-pulse"></div>
            <div className="w-8 h-20 bg-[var(--success-bg)] rounded-t animate-pulse"></div>
            <div className="w-8 h-40 bg-[var(--border-focus)] rounded-t ml-4 animate-pulse"></div>
          </div>
        </div>

        {/* Placeholder cho Giao dịch gần nhất */}
        <div className="card">
          <div className="section-label mb-4">Giao dịch gần nhất</div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <CreditCard size={18} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-semibold truncate">Cà phê The Banned</div>
                  <div className="text-xs text-[var(--text-muted)]">Hôm nay</div>
                </div>
                <div className="text-sm font-bold text-[var(--danger)]">
                  -55K
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 btn btn-ghost py-2 text-xs">Xem tất cả</button>
        </div>
      </div>
    </div>
  );
}
