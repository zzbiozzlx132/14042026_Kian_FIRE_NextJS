"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtMoney } from "@/lib/utils";
import { AlertTriangle, Calculator, CheckCircle2, Flame, LineChart, Percent, RefreshCw, Target, TrendingUp } from "lucide-react";

type PlanData = {
  mode: "expected" | "actual";
  params: {
    currentAge: number;
    targetAge: number;
    fireTargetYears: number;
    expectedReturnPct: number;
    actualReturnPct: number;
    inflationPct: number;
    swrPct: number;
    salaryGrowthPct: number;
    targetMonthlyExpenseAtFire: number;
  };
  benchmark: {
    vnIndexAnnualReturnPct: number;
    depositRatePct: number;
    depositRateSource: string;
    depositRateUpdatedAt: string | null;
  };
  totals: {
    totalNetWorth: number;
    investableNetWorth: number;
    totalCash: number;
    totalDebt: number;
    totalInvested: number;
    totalCurrentValue: number;
    totalPnL: number;
    returnPct: number;
  };
  cashflow: {
    avgMonthlyIncome: number;
    avgMonthlyExpense: number;
    avgMonthlySavings: number;
    currentMonthIncome: number;
    currentMonthExpense: number;
  };
  emergencyFund: {
    current: number;
    target6m: number;
    target12m: number;
    gap6m: number;
    gap12m: number;
    monthlyTopUpFor6mIn12Months: number;
    is6mReady: boolean;
  };
  kpi: {
    monthlyInvestTarget: number;
    monthlyExpenseCap: number;
    monthlyEmergencyTopUp: number;
    monthlyGapToPlan: number;
    thisWeekIncome: number;
    thisWeekExpense: number;
    thisWeekSavings: number;
    thisWeekInvestProgressPct: number;
  };
  fire: {
    fireNumber: number;
    fireProgressPct: number;
    yearsToFire: number;
    etaYear: number | null;
    requiredMonthlyInvestForTargetAge: number;
    requiredAnnualInvestForTargetAge: number;
    investGapMonthly: number;
  };
  allocation: {
    buckets: Array<{
      id: string;
      name: string;
      assetClass: string;
      targetPct: number;
      currentPct: number;
      targetAmount: number;
      currentAmount: number;
      monthlyAdjustAmount: number;
      exceedsGuardrail: boolean;
    }>;
    totalPct: number;
    exceedsBucketCount: boolean;
  };
  strategySuggestions: Array<{
    type: "allocation" | "valuation" | "recovery";
    title: string;
    detail: string;
    actionAmount?: number;
    etaImpactMonths?: number;
  }>;
  recoveryPlan: {
    status: "on_track" | "warning" | "recovery";
    actions: string[];
  };
};

const EMPTY_PLAN: PlanData = {
  mode: "expected",
  params: {
    currentAge: 27, targetAge: 40, fireTargetYears: 13,
    expectedReturnPct: 10, actualReturnPct: 0, inflationPct: 3, swrPct: 4, salaryGrowthPct: 5,
    targetMonthlyExpenseAtFire: 0,
  },
  benchmark: { vnIndexAnnualReturnPct: 0, depositRatePct: 6, depositRateSource: "manual_fallback", depositRateUpdatedAt: null },
  totals: { totalNetWorth: 0, investableNetWorth: 0, totalCash: 0, totalDebt: 0, totalInvested: 0, totalCurrentValue: 0, totalPnL: 0, returnPct: 0 },
  cashflow: { avgMonthlyIncome: 0, avgMonthlyExpense: 0, avgMonthlySavings: 0, currentMonthIncome: 0, currentMonthExpense: 0 },
  emergencyFund: { current: 0, target6m: 0, target12m: 0, gap6m: 0, gap12m: 0, monthlyTopUpFor6mIn12Months: 0, is6mReady: false },
  kpi: { monthlyInvestTarget: 0, monthlyExpenseCap: 0, monthlyEmergencyTopUp: 0, monthlyGapToPlan: 0, thisWeekIncome: 0, thisWeekExpense: 0, thisWeekSavings: 0, thisWeekInvestProgressPct: 0 },
  fire: { fireNumber: 0, fireProgressPct: 0, yearsToFire: -1, etaYear: null, requiredMonthlyInvestForTargetAge: 0, requiredAnnualInvestForTargetAge: 0, investGapMonthly: 0 },
  allocation: { buckets: [], totalPct: 0, exceedsBucketCount: false },
  strategySuggestions: [],
  recoveryPlan: { status: "warning", actions: [] },
};

export default function GoalsPage() {
  const [mode, setMode] = useState<"expected" | "actual">("expected");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlanData>(EMPTY_PLAN);

  const load = async (m: "expected" | "actual") => {
    setLoading(true);
    const res = await fetch(`/api/fire/plan?mode=${m}`);
    if (res.ok) {
      const payload = await res.json();
      setData(payload);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(mode);
  }, [mode]);

  const recoveryTone = useMemo(() => {
    if (data.recoveryPlan.status === "on_track") return "text-[var(--success)]";
    if (data.recoveryPlan.status === "recovery") return "text-[var(--danger)]";
    return "text-[var(--warning)]";
  }, [data.recoveryPlan.status]);

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">FIRE Command Center</h1>
          <p className="text-sm text-[var(--text-muted)]">Lộ trình hành động tháng + checkpoint tuần để tăng tốc đến tự do tài chính.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("expected")} className={`btn text-sm ${mode === "expected" ? "btn-primary" : "btn-ghost border border-[var(--border)]"}`}>Expected</button>
          <button onClick={() => setMode("actual")} className={`btn text-sm ${mode === "actual" ? "btn-primary" : "btn-ghost border border-[var(--border)]"}`}>Actual (TWR)</button>
          <button onClick={() => load(mode)} className="btn btn-ghost border border-[var(--border)] text-sm"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Tháng này phải làm gì" icon={Target}>
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <Row label="Cần đầu tư" value={fmtMoney(data.kpi.monthlyInvestTarget)} strong />
              <Row label="Trần chi tiêu" value={fmtMoney(data.kpi.monthlyExpenseCap)} />
              <Row label="Bù quỹ dự phòng" value={fmtMoney(data.kpi.monthlyEmergencyTopUp)} />
              <Row label="Gap tháng hiện tại" value={data.kpi.monthlyGapToPlan > 0 ? fmtMoney(data.kpi.monthlyGapToPlan) : "Đạt kế hoạch"} valueClass={data.kpi.monthlyGapToPlan > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"} />
            </div>
          )}
        </Card>

        <Card title="Checkpoint tuần" icon={LineChart}>
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <Row label="Thu tuần này" value={fmtMoney(data.kpi.thisWeekIncome)} />
              <Row label="Chi tuần này" value={fmtMoney(data.kpi.thisWeekExpense)} />
              <Row label="Tích lũy tuần này" value={fmtMoney(data.kpi.thisWeekSavings)} />
              <Row label="Tiến độ mục tiêu tháng" value={`${data.kpi.thisWeekInvestProgressPct}%`} valueClass={data.kpi.thisWeekInvestProgressPct >= 25 ? "text-[var(--success)]" : "text-[var(--warning)]"} />
            </div>
          )}
        </Card>

        <Card title="FIRE ETA" icon={Flame}>
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <Row label="FIRE Number" value={fmtMoney(data.fire.fireNumber)} strong />
              <Row label="Tiến độ hiện tại" value={`${data.fire.fireProgressPct}%`} />
              <Row label="Dự kiến đạt FIRE" value={data.fire.etaYear ? `${data.fire.etaYear}` : "Chưa xác định"} />
              <Row label="Số năm còn lại" value={data.fire.yearsToFire > 0 ? `${data.fire.yearsToFire} năm` : "Cần cải thiện KPI"} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Quỹ dự phòng 6-12 tháng" icon={CheckCircle2}>
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <Row label="Hiện có" value={fmtMoney(data.emergencyFund.current)} />
              <Row label="Mục tiêu 6 tháng" value={fmtMoney(data.emergencyFund.target6m)} />
              <Row label="Mục tiêu 12 tháng" value={fmtMoney(data.emergencyFund.target12m)} />
              <Row label="Còn thiếu mốc 6 tháng" value={data.emergencyFund.gap6m > 0 ? fmtMoney(data.emergencyFund.gap6m) : "Đã đạt"} valueClass={data.emergencyFund.gap6m > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"} />
            </div>
          )}
        </Card>

        <Card title="Recovery Playbook" icon={AlertTriangle}>
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <div className={`text-xs font-semibold uppercase tracking-wider ${recoveryTone}`}>{data.recoveryPlan.status}</div>
              {data.recoveryPlan.actions.map((a, idx) => (
                <div key={idx} className="text-[var(--text-secondary)] leading-relaxed">• {a}</div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Đề xuất phân bổ chiến lược (4-5 danh mục)</h3>
        </div>
        {loading ? <Skeleton /> : (
          <div className="space-y-3">
            {data.allocation.buckets.map((b) => (
              <div key={b.id} className="grid grid-cols-12 gap-2 items-center p-3 border border-[var(--border)] rounded-xl">
                <div className="col-span-3 font-semibold text-sm">{b.name}</div>
                <div className="col-span-2 text-xs text-[var(--text-muted)]">{b.assetClass}</div>
                <div className="col-span-2 text-sm">Target {b.targetPct}%</div>
                <div className="col-span-2 text-sm">Hiện tại {b.currentPct}%</div>
                <div className={`col-span-3 text-sm font-semibold ${b.monthlyAdjustAmount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {b.monthlyAdjustAmount >= 0 ? "+" : ""}{fmtMoney(b.monthlyAdjustAmount)}
                </div>
              </div>
            ))}
            <div className="text-xs text-[var(--text-muted)]">
              Tổng phân bổ mục tiêu: {data.allocation.totalPct}% {data.allocation.totalPct !== 100 ? "(cần chỉnh về 100%)" : ""}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Investment Strategy Suggestions</h3>
        </div>
        {loading ? <Skeleton /> : (
          <div className="space-y-3">
            <div className="text-xs text-[var(--text-muted)]">
              Benchmark: VNINDEX {data.benchmark.vnIndexAnnualReturnPct}% | Lãi gửi {data.benchmark.depositRatePct}% ({data.benchmark.depositRateSource})
            </div>
            {data.strategySuggestions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Chưa đủ dữ liệu để phát sinh đề xuất nâng cao.</p>
            ) : data.strategySuggestions.map((s, idx) => (
              <div key={idx} className="p-3 border border-[var(--border)] rounded-xl">
                <div className="font-semibold text-sm mb-1">{s.title}</div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">{s.detail}</div>
                {(s.actionAmount || s.etaImpactMonths) && (
                  <div className="text-xs text-[var(--text-muted)]">
                    {s.actionAmount ? `Mức hành động: ${fmtMoney(s.actionAmount)}. ` : ""}
                    {s.etaImpactMonths ? `Tác động ETA ước tính: ${s.etaImpactMonths} tháng.` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Thông số mô hình</h3>
        </div>
        {loading ? <Skeleton /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <MiniStat label="Expected Return" value={`${data.params.expectedReturnPct}%`} />
            <MiniStat label="Actual Return (TWR proxy)" value={`${data.params.actualReturnPct}%`} />
            <MiniStat label="Inflation" value={`${data.params.inflationPct}%`} />
            <MiniStat label="SWR" value={`${data.params.swrPct}%`} />
            <MiniStat label="Mục tiêu tháng đầu tư" value={fmtMoney(data.fire.requiredMonthlyInvestForTargetAge)} />
            <MiniStat label="Mục tiêu năm đầu tư" value={fmtMoney(data.fire.requiredAnnualInvestForTargetAge)} />
            <MiniStat label="Tuổi hiện tại" value={`${data.params.currentAge}`} />
            <MiniStat label="Tuổi FIRE mục tiêu" value={`${data.params.targetAge}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-[var(--accent)]" />
        <h3 className="section-label mb-0">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, strong, valueClass }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`${strong ? "font-bold" : "font-semibold"} ${valueClass || ""}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="skeleton h-24 w-full"></div>;
}
