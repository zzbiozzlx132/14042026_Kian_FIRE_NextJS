"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { CHART_COLORS } from "@/lib/constants";
import { fmtMoney, fmtMoneyCompact, fmtDate } from "@/lib/utils";
import { TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight, Activity, ReceiptText, Send, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardData {
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  totalCredit: number;
  totalInvest: number;
  accountCount: number;
  transactionCount: number;
  holdingInvestmentCount: number;
  monthlyIncome: number;
  monthlyExpense: number;
  rangeDays: number;
  periodIncome: number;
  periodExpense: number;
  periodNet: number;
  avgDailyExpense: number;
  biggestExpenseDay: { label: string; expense: number } | null;
  dailyFlow: { date: string; label: string; income: number; expense: number; net: number }[];
  expenseByCategory: { name: string; value: number }[];
  expenseByAccount: { name: string; value: number }[];
  recentTransactions: any[];
}

const RANGE_OPTIONS = [
  { label: "7 ngày", value: 7 },
  { label: "30 ngày", value: 30 },
  { label: "90 ngày", value: 90 },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [pairInfo, setPairInfo] = useState<{ paired: boolean; code?: string; botUsername?: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?range=${range}`)
      .then(r => {
        if (!r.ok) throw new Error("API Error");
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    fetch("/api/telegram/pair").then(r => r.json()).then(d => setPairInfo(d)).catch(() => {});
  }, []);

  const d = data || {
    netWorth: 0, totalAssets: 0, totalDebt: 0, totalCredit: 0,
    totalInvest: 0, accountCount: 0, transactionCount: 0, holdingInvestmentCount: 0, monthlyIncome: 0, monthlyExpense: 0,
    rangeDays: range, periodIncome: 0, periodExpense: 0, periodNet: 0,
    avgDailyExpense: 0, biggestExpenseDay: null,
    dailyFlow: [], expenseByCategory: [], expenseByAccount: [],
    recentTransactions: []
  };

  const month = new Date().getMonth() + 1;
  const showQuickStart = !loading && (d.accountCount < 1 || d.transactionCount < 3 || d.holdingInvestmentCount < 1);
  const quickSteps = [
    { label: "Tạo tài khoản/ví để ghi nhận dòng tiền", done: d.accountCount >= 1, href: "/assets" },
    { label: "Nhập ít nhất 3 giao dịch gần đây", done: d.transactionCount >= 3, href: "/transactions/new" },
    { label: "Khai báo ít nhất 1 khoản đầu tư (nếu có)", done: d.holdingInvestmentCount >= 1, href: "/assets" },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <Header userName={session?.user?.name || "Bạn"} />

      {/* Onboarding banner — chỉ hiện khi chưa pair Telegram */}
      {pairInfo && !pairInfo.paired && pairInfo.code && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-in fade-in duration-300">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Send size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-0.5">
              Còn 1 bước để bắt đầu — Kết nối Telegram
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              Mã của bạn: <code className="font-bold tracking-widest text-sm bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{pairInfo.code}</code>
              {" "}— Mở bot Telegram, gõ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">/pair {pairInfo.code}</code>
            </div>
          </div>
          {pairInfo.botUsername && (
            <a
              href={`https://t.me/${pairInfo.botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              Mở Telegram <ExternalLink size={14} />
            </a>
          )}
          {!pairInfo.botUsername && (
            <Link href="/settings?tab=telegram" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex-shrink-0">
              Cài đặt bot <ExternalLink size={14} />
            </Link>
          )}
        </div>
      )}

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
                {loading ? "..." : `+${fmtMoney(d.totalAssets)}`}
              </div>
            </div>
            <div className="bg-[var(--bg-input)] px-4 py-3 rounded-xl min-w-[140px]">
              <div className="text-xs text-[var(--text-muted)] font-semibold mb-1 uppercase tracking-wider">Tổng nợ & thẻ</div>
              <div className="text-lg font-bold text-[var(--danger)]">
                {loading ? "..." : `-${fmtMoney(d.totalDebt)}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showQuickStart && (
        <div className="card mb-8">
          <div className="section-label mb-2">Bắt đầu nhanh</div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Thiết lập 3 bước này để số liệu FIRE và gợi ý tự động chính xác hơn.
          </p>
          <div className="space-y-2">
            {quickSteps.map((step) => (
              <Link key={step.label} href={step.href} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-card-hover)]">
                <div className="flex items-center gap-2 text-sm">
                  {step.done ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : <Circle size={16} className="text-[var(--text-muted)]" />}
                  <span>{step.label}</span>
                </div>
                <span className={`text-xs font-semibold ${step.done ? "text-[var(--success)]" : "text-[var(--accent)]"}`}>
                  {step.done ? "Đã xong" : "Làm ngay"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ArrowDownRight} label={`Thu nhập T${month}`} value={d.monthlyIncome} color="success" loading={loading} />
        <StatCard icon={ArrowUpRight} label={`Chi tiêu T${month}`} value={d.monthlyExpense} color="danger" loading={loading} />
        <StatCard icon={CreditCard} label="Nợ thẻ tín dụng" value={d.totalCredit} color="info" loading={loading} />
        <StatCard icon={TrendingUp} label="Tổng đầu tư" value={d.totalInvest} color="accent" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2 min-h-[360px]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div>
              <div className="section-label mb-1">Dòng tiền</div>
              <div className="text-sm text-[var(--text-muted)]">
                Thu, chi và chênh lệch trong {d.rangeDays} ngày gần nhất
              </div>
            </div>
            <RangeSelector value={range} onChange={setRange} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <MiniMetric label="Thu" value={d.periodIncome} tone="success" loading={loading} />
            <MiniMetric label="Chi" value={d.periodExpense} tone="danger" loading={loading} />
            <MiniMetric label="Còn lại" value={d.periodNet} tone={d.periodNet >= 0 ? "success" : "danger"} loading={loading} />
            <MiniMetric label="Chi/ngày" value={d.avgDailyExpense} tone="muted" loading={loading} />
          </div>
          <ChartEmpty loading={loading} hasData={d.dailyFlow.some(day => day.income > 0 || day.expense > 0)}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={d.dailyFlow} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(value) => fmtMoneyCompact(Number(value))} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" name="Thu" dataKey="income" stroke="#059669" fill="url(#incomeFill)" strokeWidth={2} />
                <Area type="monotone" name="Chi" dataKey="expense" stroke="#DC2626" fill="url(#expenseFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartEmpty>
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
                    {tx.type === "INCOME" ? "+" : "-"}{fmtMoney(tx.amount)}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card min-h-[320px]">
          <div className="section-label mb-1">Chi theo hạng mục</div>
          <div className="text-sm text-[var(--text-muted)] mb-5">Nhóm nào đang lấy nhiều tiền nhất</div>
          <ChartEmpty loading={loading} hasData={d.expenseByCategory.length > 0}>
            <ResponsiveContainer width="100%" height={245}>
              <PieChart>
                <Pie
                  data={d.expenseByCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {d.expenseByCategory.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<MoneyTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartEmpty>
        </div>

        <div className="card min-h-[320px]">
          <div className="section-label mb-1">Chi theo tài khoản</div>
          <div className="text-sm text-[var(--text-muted)] mb-5">Tiền ra từ ví/ngân hàng/thẻ nào</div>
          <ChartEmpty loading={loading} hasData={d.expenseByAccount.length > 0}>
            <ResponsiveContainer width="100%" height={245}>
              <BarChart data={d.expenseByAccount} layout="vertical" margin={{ top: 4, right: 14, left: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => fmtMoneyCompact(Number(value))} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="value" name="Chi" radius={[0, 8, 8, 0]}>
                  {d.expenseByAccount.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartEmpty>
        </div>

        <div className="card min-h-[320px]">
          <div className="section-label mb-1">Điểm nóng chi tiêu</div>
          <div className="text-sm text-[var(--text-muted)] mb-5">Tóm tắt theo khoảng thời gian đang chọn</div>
          <div className="space-y-4">
            <InsightRow label="Ngày chi nhiều nhất" value={d.biggestExpenseDay?.expense ? `${d.biggestExpenseDay.label} · ${fmtMoney(d.biggestExpenseDay.expense)}` : "Chưa có dữ liệu"} />
            <InsightRow label="Hạng mục lớn nhất" value={d.expenseByCategory[0] ? `${d.expenseByCategory[0].name} · ${fmtMoney(d.expenseByCategory[0].value)}` : "Chưa có dữ liệu"} />
            <InsightRow label="Tài khoản chi nhiều" value={d.expenseByAccount[0] ? `${d.expenseByAccount[0].name} · ${fmtMoney(d.expenseByAccount[0].value)}` : "Chưa có dữ liệu"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex h-10 items-center rounded-xl bg-[var(--bg-input)] p-1">
      {RANGE_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
            value === option.value
              ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MiniMetric({ label, value, tone, loading }: { label: string; value: number; tone: string; loading: boolean }) {
  const toneClass: Record<string, string> = {
    success: "text-[var(--success)]",
    danger: "text-[var(--danger)]",
    muted: "text-[var(--text-primary)]",
  };

  return (
    <div className="rounded-xl bg-[var(--bg-input)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</div>
      <div className={`text-sm font-bold ${toneClass[tone] || toneClass.muted}`}>
        {loading ? "..." : fmtMoney(value)}
      </div>
    </div>
  );
}

function ChartEmpty({ loading, hasData, children }: { loading: boolean; hasData: boolean; children: ReactNode }) {
  if (loading) return <div className="skeleton h-[245px] w-full rounded-xl" />;
  if (!hasData) {
    return (
      <div className="h-[245px] flex items-center justify-center rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-muted)]">
        Chưa có dữ liệu trong khoảng này
      </div>
    );
  }
  return <>{children}</>;
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-input)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-sm font-bold leading-snug">{value}</div>
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
      {label && <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">{label}</div>}
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={`${item.name}-${item.dataKey || item.value}`} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--text-muted)]">{item.name}</span>
            <span className="font-bold">{fmtMoney(item.value)}</span>
          </div>
        ))}
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
    accent: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
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
        {loading ? <div className="skeleton h-6 w-20"></div> : fmtMoney(value)}
      </div>
    </div>
  );
}
