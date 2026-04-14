"use client";

import { useEffect, useState } from "react";
import { fmtMoney, fmtMoneyCompact } from "@/lib/utils";
import { TrendingUp, Calculator, Target, ArrowUpRight, ArrowDownRight, Info, Flame, Percent } from "lucide-react";

interface Projection {
  years: number;
  futureValue: number;
  realFutureValue: number;
  totalContributed: number;
  interestEarned: number;
}

interface FireScenario {
  years: number;
  requiredReturnPct: number;
}

interface ProjectionData {
  totalInvested: number;
  totalCurrentValue: number;
  totalPnL: number;
  returnPct: number;
  expectedReturnPct: number;
  inflationPct: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlySavings: number;
  fireNumber: number;
  fireProgress: number;
  yearsToFire: number;
  totalNetWorth: number;
  fireScenarios: FireScenario[];
  projections: Projection[];
  investmentCount: number;
}

export default function GoalsPage() {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projections")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const d = data || {
    totalInvested: 0, totalCurrentValue: 0, totalPnL: 0, returnPct: 0,
    expectedReturnPct: 10, inflationPct: 3, avgMonthlyIncome: 0,
    avgMonthlyExpense: 0, avgMonthlySavings: 0, fireNumber: 0,
    fireProgress: 0, yearsToFire: -1, totalNetWorth: 0,
    fireScenarios: [], projections: [], investmentCount: 0,
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Dự phóng & FIRE</h1>
        <p className="text-sm text-[var(--text-muted)]">Tính lãi kép + Mục tiêu Tự do Tài chính dựa trên dữ liệu thực</p>
      </div>

      {/* ═══ FIRE OVERVIEW ═══ */}
      <div className="card-glass mb-8 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8">
          {/* FIRE Number */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                <Flame size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">FIRE Number</div>
                <div className="text-xs text-[var(--text-muted)]">25 × Chi tiêu năm (Quy tắc 4%)</div>
              </div>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-2">
              {loading ? <div className="skeleton h-9 w-48"></div> : fmtMoney(d.fireNumber)}
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-muted)]">Tiến độ</span>
                <span className="font-bold text-[var(--accent)]">{d.fireProgress}%</span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-input)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, d.fireProgress)}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Tài sản hiện tại: <span className="font-bold text-[var(--text-primary)]">{fmtMoney(d.totalNetWorth)}</span>
            </div>
          </div>

          {/* Years to FIRE */}
          <div className="flex-shrink-0 md:border-l md:border-[var(--border)] md:pl-8 flex flex-col justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Dự kiến đạt FIRE trong
            </div>
            <div className="text-5xl font-extrabold tracking-tighter text-[var(--accent)]">
              {loading ? "..." : d.yearsToFire > 0 ? `${d.yearsToFire}` : "∞"}
            </div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              {d.yearsToFire > 0 ? "năm" : "Cần thêm dữ liệu thu chi"}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FIRE SCENARIOS ═══ */}
      <div className="card mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
            <Percent size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold">Lãi suất cần để đạt FIRE</h2>
            <p className="text-xs text-[var(--text-muted)]">Với vốn hiện tại {fmtMoneyCompact(d.totalNetWorth)} + góp thêm {fmtMoneyCompact(d.avgMonthlySavings)}/tháng</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {d.fireScenarios.map(s => (
            <div key={s.years} className="border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--accent)] transition-colors">
              <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
                {s.years} năm
              </div>
              <div className={`text-2xl font-extrabold ${
                s.requiredReturnPct <= 10 ? "text-[var(--success)]" :
                s.requiredReturnPct <= 20 ? "text-[var(--warning)]" :
                s.requiredReturnPct <= 50 ? "text-[var(--danger)]" :
                "text-[var(--text-muted)]"
              }`}>
                {s.requiredReturnPct > 90 ? "N/A" : `${s.requiredReturnPct}%`}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">lãi/năm</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4 text-[10px] text-[var(--text-muted)]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] mr-1"></span> Dễ đạt (≤10%)</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--warning)] mr-1"></span> Nỗ lực (10-20%)</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--danger)] mr-1"></span> Rất khó (20-50%)</span>
        </div>
      </div>

      {/* ═══ INVESTMENT SUMMARY ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={Target} label="Vốn đã đầu tư" value={fmtMoneyCompact(d.totalInvested)} color="bg-blue-50 text-blue-600" loading={loading} />
        <SummaryCard icon={TrendingUp} label="Giá trị hiện tại" value={fmtMoneyCompact(d.totalCurrentValue)} color="bg-indigo-50 text-indigo-600" loading={loading} />
        <SummaryCard icon={d.totalPnL >= 0 ? ArrowUpRight : ArrowDownRight} label="Lãi/Lỗ" value={`${d.totalPnL >= 0 ? "+" : ""}${fmtMoneyCompact(d.totalPnL)} (${d.returnPct}%)`} color={d.totalPnL >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"} loading={loading} />
        <SummaryCard icon={Calculator} label="Tiết kiệm TB/tháng" value={fmtMoneyCompact(d.avgMonthlySavings)} color="bg-amber-50 text-amber-600" loading={loading} />
      </div>

      {/* ═══ PARAMETERS ═══ */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Lãi suất kỳ vọng:</span>
            <span className="font-bold text-[var(--success)]">{d.expectedReturnPct}%/năm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Lạm phát:</span>
            <span className="font-bold text-[var(--danger)]">{d.inflationPct}%/năm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Chi tiêu TB/tháng:</span>
            <span className="font-bold">{fmtMoney(d.avgMonthlyExpense)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Thu nhập TB/tháng:</span>
            <span className="font-bold text-[var(--success)]">{fmtMoney(d.avgMonthlyIncome)}</span>
          </div>
        </div>
      </div>

      {/* ═══ COMPOUND TABLE 1→30 ═══ */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Calculator size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Bảng lãi kép 1 → 30 năm</h2>
            <p className="text-xs text-[var(--text-muted)]">FV = P×(1+r)^n + PMT×((1+r)^n − 1)/r | Vốn: {fmtMoneyCompact(d.totalNetWorth)} + {fmtMoneyCompact(d.avgMonthlySavings)}/tháng @ {d.expectedReturnPct}%</p>
          </div>
        </div>

        {d.projections.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-[var(--bg-input)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calculator size={24} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-muted)] text-sm">Thêm khoản đầu tư hoặc giao dịch để xem dự phóng</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wider">Năm</th>
                  <th className="text-right py-3 px-4 text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wider">Tổng góp vốn</th>
                  <th className="text-right py-3 px-4 text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wider">Lãi kép tích luỹ</th>
                  <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-wider text-[var(--accent)]">Tổng tài sản</th>
                  <th className="text-right py-3 px-4 text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wider">Giá trị thực<br/><span className="text-[10px] font-normal">(sau lạm phát)</span></th>
                </tr>
              </thead>
              <tbody>
                {d.projections.map((p) => {
                  const isHighlight = [5, 10, 15, 20, 25, 30].includes(p.years);
                  const isFire = d.fireNumber > 0 && p.futureValue >= d.fireNumber;
                  return (
                    <tr
                      key={p.years}
                      className={`border-b border-[var(--border-light)] transition-colors hover:bg-[var(--bg-card-hover)] ${
                        isHighlight ? "bg-[var(--accent-muted)]" : ""
                      } ${isFire && !isHighlight ? "bg-orange-50/50" : ""}`}
                    >
                      <td className={`py-2.5 px-4 ${isHighlight ? "font-bold text-[var(--accent)]" : "font-medium"}`}>
                        <span className="flex items-center gap-1.5">
                          Năm {p.years}
                          {isFire && p.years === d.projections.find(pp => pp.futureValue >= d.fireNumber)?.years && (
                            <Flame size={14} className="text-orange-500" />
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] text-xs">
                        {fmtMoney(p.totalContributed)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[var(--success)] text-xs">
                        +{fmtMoney(p.interestEarned)}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${isHighlight ? "text-base" : "text-sm"}`}>
                        {fmtMoney(p.futureValue)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[var(--text-muted)] text-xs">
                        {fmtMoney(p.realFutureValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, loading }: {
  icon: any; label: string; value: string; color: string; loading: boolean;
}) {
  return (
    <div className="card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold">
        {loading ? <div className="skeleton h-6 w-24"></div> : value}
      </div>
    </div>
  );
}
