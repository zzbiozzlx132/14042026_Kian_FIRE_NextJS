"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { fmtMoney } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, Calculator, CheckCircle2, CircleHelp, Flame, LineChart, Percent, RefreshCw, Settings2, Target, TrendingUp, X } from "lucide-react";

type PlanData = {
  mode: "expected" | "actual";
  params: {
    birthYear?: number | null;
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
    monthsInWindow: number;
    expenseTotalWindow: number;
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

type FireSettingsForm = {
  birthYear: number;
  targetAge: number;
  expectedReturnPct: number;
  inflationPct: number;
  swrPct: number;
  salaryGrowthPct: number;
  targetMonthlyExpenseAtFire: number;
  plannedMonthlyInvest: number;
  riskProfile: string;
  objectiveMode: string;
  missedTargetPolicy: string;
  depositRateSource: string;
  depositRateManual: number;
};

type AllocationBucketForm = {
  id: string;
  name: string;
  assetClass: string;
  targetPct: number;
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
  cashflow: { avgMonthlyIncome: 0, avgMonthlyExpense: 0, avgMonthlySavings: 0, monthsInWindow: 1, expenseTotalWindow: 0, currentMonthIncome: 0, currentMonthExpense: 0 },
  emergencyFund: { current: 0, target6m: 0, target12m: 0, gap6m: 0, gap12m: 0, monthlyTopUpFor6mIn12Months: 0, is6mReady: false },
  kpi: { monthlyInvestTarget: 0, monthlyExpenseCap: 0, monthlyEmergencyTopUp: 0, monthlyGapToPlan: 0, thisWeekIncome: 0, thisWeekExpense: 0, thisWeekSavings: 0, thisWeekInvestProgressPct: 0 },
  fire: { fireNumber: 0, fireProgressPct: 0, yearsToFire: -1, etaYear: null, requiredMonthlyInvestForTargetAge: 0, requiredAnnualInvestForTargetAge: 0, investGapMonthly: 0 },
  allocation: { buckets: [], totalPct: 0, exceedsBucketCount: false },
  strategySuggestions: [],
  recoveryPlan: { status: "warning", actions: [] },
};

export default function GoalsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const currentYear = new Date().getFullYear();

  const [mode, setMode] = useState<"expected" | "actual">("expected");
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [data, setData] = useState<PlanData>(EMPTY_PLAN);
  const [form, setForm] = useState<FireSettingsForm>({
    birthYear: currentYear - 27,
    targetAge: 40,
    expectedReturnPct: 10,
    inflationPct: 3,
    swrPct: 4,
    salaryGrowthPct: 5,
    targetMonthlyExpenseAtFire: 0,
    plannedMonthlyInvest: 0,
    riskProfile: "capital_preservation",
    objectiveMode: "fast_but_safe",
    missedTargetPolicy: "cut_expense_first",
    depositRateSource: "worldbank_vn",
    depositRateManual: 6,
  });
  const [alloc, setAlloc] = useState<AllocationBucketForm[]>([]);

  const allocTotal = useMemo(() => alloc.reduce((sum, b) => sum + Number(b.targetPct || 0), 0), [alloc]);
  const derivedAgeFromBirthYear = useMemo(() => {
    const year = Number(form.birthYear || 0);
    if (!year || year < 1900 || year > currentYear) return data.params.currentAge;
    return Math.max(18, currentYear - year);
  }, [form.birthYear, currentYear, data.params.currentAge]);

  const monthlyEquivalentRatePct = useMemo(
    () => ((Math.pow(1 + Number(data.params.expectedReturnPct || 0) / 100, 1 / 12) - 1) * 100),
    [data.params.expectedReturnPct],
  );
  const isActualReturnOutlier = Math.abs(Number(data.params.actualReturnPct || 0)) > 200;
  const actualReturnDisplay = useMemo(
    () => `${Number(data.params.actualReturnPct || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`,
    [data.params.actualReturnPct],
  );

  const loadPlan = useCallback(async (m: "expected" | "actual") => {
    setLoading(true);
    const res = await fetch(`/api/fire/plan?mode=${m}`);
    if (res.ok) {
      const payload = await res.json();
      setData(payload);
    }
    setLoading(false);
  }, []);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const [settingsRes, allocRes] = await Promise.all([
      fetch("/api/fire/settings"),
      fetch("/api/fire/allocation"),
    ]);

    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      const inferredBirthYear = Number(settings.birthYear || 0) > 1900
        ? Number(settings.birthYear)
        : currentYear - Number(settings.derivedCurrentAge || settings.currentAge || 27);
      setForm({
        birthYear: inferredBirthYear,
        targetAge: Number(settings.targetAge || 40),
        expectedReturnPct: Number(settings.expectedReturnPct || 10),
        inflationPct: Number(settings.inflationPct || 3),
        swrPct: Number(settings.swrPct || 4),
        salaryGrowthPct: Number(settings.salaryGrowthPct || 5),
        targetMonthlyExpenseAtFire: Number(settings.targetMonthlyExpenseAtFire || 0),
        plannedMonthlyInvest: Number(settings.plannedMonthlyInvest || 0),
        riskProfile: settings.riskProfile || "capital_preservation",
        objectiveMode: settings.objectiveMode || "fast_but_safe",
        missedTargetPolicy: settings.missedTargetPolicy || "cut_expense_first",
        depositRateSource: settings.depositRateSource || "worldbank_vn",
        depositRateManual: Number(settings.depositRateManual || 6),
      });
    }

    if (allocRes.ok) {
      const allocation = await allocRes.json();
      const buckets = Array.isArray(allocation?.buckets) ? allocation.buckets : [];
      setAlloc(
        buckets.map((b: any) => ({
          id: String(b.id),
          name: String(b.name),
          assetClass: String(b.assetClass || "OTHER"),
          targetPct: Number(b.targetPct || 0),
        })),
      );
    }

    setConfigLoading(false);
  }, [currentYear]);

  const saveFireConfig = async () => {
    if (!isAdmin) return;
    if (alloc.length === 0) {
      toast.error("Cần ít nhất 1 danh mục phân bổ");
      return;
    }
    if (alloc.length > 5) {
      toast.error("Tối đa 5 danh mục phân bổ");
      return;
    }
    if (Math.abs(allocTotal - 100) > 0.01) {
      toast.error("Tổng phân bổ phải bằng 100%");
      return;
    }

    setSavingConfig(true);
    const [settingsRes, allocRes] = await Promise.all([
      fetch("/api/fire/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthYear: Number(form.birthYear),
          currentAge: derivedAgeFromBirthYear,
          targetAge: Number(form.targetAge || 40),
          expectedReturnPct: Number(form.expectedReturnPct || 10),
          inflationPct: Number(form.inflationPct || 3),
          swrPct: Number(form.swrPct || 4),
          salaryGrowthPct: Number(form.salaryGrowthPct || 5),
          targetMonthlyExpenseAtFire: Number(form.targetMonthlyExpenseAtFire || 0),
          plannedMonthlyInvest: Number(form.plannedMonthlyInvest || 0),
          riskProfile: form.riskProfile,
          objectiveMode: form.objectiveMode,
          missedTargetPolicy: form.missedTargetPolicy,
          depositRateSource: form.depositRateSource,
          depositRateManual: Number(form.depositRateManual || 0),
        }),
      }),
      fetch("/api/fire/allocation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buckets: alloc.map((b, idx) => ({
            id: b.id,
            name: b.name,
            assetClass: b.assetClass,
            targetPct: Number(b.targetPct || 0),
            sortOrder: idx + 1,
          })),
        }),
      }),
    ]);

    if (settingsRes.ok && allocRes.ok) {
      toast.success("Đã lưu FIRE Control");
      await Promise.all([loadConfig(), loadPlan(mode)]);
    } else {
      const err1 = settingsRes.ok ? "" : (await settingsRes.json().catch(() => ({}))).error;
      const err2 = allocRes.ok ? "" : (await allocRes.json().catch(() => ({}))).error;
      toast.error(err1 || err2 || "Lưu cấu hình FIRE thất bại");
    }
    setSavingConfig(false);
  };

  useEffect(() => {
    loadPlan(mode);
  }, [mode, loadPlan]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
          <button onClick={() => setIsSettingsOpen(true)} className="btn btn-ghost border border-[var(--border)] text-sm">
            <Settings2 size={14} />
            <span>Cài đặt FIRE</span>
          </button>
          <button onClick={() => setMode("expected")} className={`btn text-sm ${mode === "expected" ? "btn-primary" : "btn-ghost border border-[var(--border)]"}`}>Expected</button>
          <button onClick={() => setMode("actual")} className={`btn text-sm ${mode === "actual" ? "btn-primary" : "btn-ghost border border-[var(--border)]"}`}>Actual (TWR)</button>
          <button onClick={() => { loadPlan(mode); loadConfig(); }} className="btn btn-ghost border border-[var(--border)] text-sm"><RefreshCw size={14} /></button>
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
              <p className="text-xs text-[var(--text-muted)]">
                Công thức: mốc 6 tháng = chi tiêu TB/tháng x 6, mốc 12 tháng = chi tiêu TB/tháng x 12.
              </p>
              <Row label="Tổng chi đã lấy để tính" value={fmtMoney(data.cashflow.expenseTotalWindow)} />
              <Row label="Số tháng dữ liệu" value={`${data.cashflow.monthsInWindow} tháng`} />
              <Row label="Chi tiêu TB/tháng dùng để tính" value={fmtMoney(data.cashflow.avgMonthlyExpense)} />
              <Row label="Quỹ dự phòng hiện có" value={fmtMoney(data.emergencyFund.current)} />
              <Row label="Mục tiêu quỹ 6 tháng" value={fmtMoney(data.emergencyFund.target6m)} />
              <Row label="Mục tiêu quỹ 12 tháng" value={fmtMoney(data.emergencyFund.target12m)} />
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
                  {b.monthlyAdjustAmount >= 0 ? `Cần tăng ~${fmtMoney(Math.abs(b.monthlyAdjustAmount))}` : `Cần giảm ~${fmtMoney(Math.abs(b.monthlyAdjustAmount))}`}
                </div>
              </div>
            ))}
            <div className="text-xs text-[var(--text-muted)]">
              +/- ở đây là số tiền tái cân bằng gợi ý cho tháng này để tiến dần về target, không phải lãi/lỗ.
            </div>
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
            <MiniStat
              label="Lãi suất kỳ vọng (%/năm)"
              value={`${data.params.expectedReturnPct}%`}
              hint="Mức lợi suất mục tiêu theo năm để dự phóng lộ trình FIRE."
            />
            <MiniStat
              label="Lợi suất thực tế (TWR proxy)"
              value={actualReturnDisplay}
              valueClass={isActualReturnOutlier ? "text-[var(--warning)]" : ""}
              hint="Lợi suất danh mục tính gần đúng theo thời gian nắm giữ. Có thể nhiễu mạnh khi dữ liệu giá sai hoặc vị thế mới mở."
            />
            <MiniStat label="Lạm phát (%/năm)" value={`${data.params.inflationPct}%`} hint="Dùng để quy đổi sức mua tương lai khi tính FIRE Number." />
            <MiniStat label="SWR (%/năm)" value={`${data.params.swrPct}%`} hint="Tỷ lệ rút tiền an toàn mỗi năm sau khi FIRE (mặc định thường dùng 4%)." />
            <MiniStat label="Mục tiêu đầu tư tháng" value={fmtMoney(data.fire.requiredMonthlyInvestForTargetAge)} hint="Số tiền cần đầu tư mỗi tháng để kịp mốc tuổi FIRE đã đặt." />
            <MiniStat label="Mục tiêu đầu tư năm" value={fmtMoney(data.fire.requiredAnnualInvestForTargetAge)} hint="Bằng mục tiêu đầu tư tháng x 12." />
            <MiniStat label="Năm sinh" value={`${data.params.birthYear || form.birthYear}`} hint="Dùng để tự tính tuổi hiện tại theo năm, không cần sửa tay mỗi năm." />
            <MiniStat label="Tuổi hiện tại (tự tính)" value={`${data.params.currentAge}`} />
            <MiniStat label="Tuổi FIRE mục tiêu" value={`${data.params.targetAge}`} />
          </div>
        )}
        {isActualReturnOutlier && (
          <p className="text-xs text-[var(--warning)] mt-3">
            Lợi suất thực tế đang rất cao bất thường, thường do giá tài sản auto bị nhiễu/sai đơn vị. Bạn kiểm tra lại giá của các mã đang bật AUTO.
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Lãi suất kỳ vọng 10% là theo năm. Hệ thống quy đổi lãi kép theo tháng khoảng {monthlyEquivalentRatePct.toFixed(2)}%/tháng, không phải 10% mỗi tháng.
        </p>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] p-4 md:p-8" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="mx-auto w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 md:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-[var(--accent)]" />
                <h3 className="section-label mb-0">FIRE Control Settings</h3>
              </div>
              <button className="btn btn-ghost border border-[var(--border)] p-2" onClick={() => setIsSettingsOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Đặt 1 lần theo năm sinh + mục tiêu FIRE. Hệ thống tự tính tuổi hiện tại mỗi năm, không cần bạn cập nhật tuổi thủ công.
            </p>
            {!isAdmin && <p className="text-xs text-[var(--warning)] mb-3">Bạn đang ở chế độ chỉ xem. Chỉ Admin mới lưu được thay đổi.</p>}

            {configLoading ? <Skeleton /> : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Năm sinh</label>
                    <input
                      type="number"
                      className="input"
                      value={form.birthYear}
                      onChange={(e) => setForm({ ...form, birthYear: Number(e.target.value) || currentYear - 27 })}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tuổi hiện tại (tự tính)</label>
                    <input type="number" className="input" value={derivedAgeFromBirthYear} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tuổi mục tiêu FIRE</label>
                    <input type="number" className="input" value={form.targetAge} onChange={(e) => setForm({ ...form, targetAge: Number(e.target.value) || 40 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lãi suất kỳ vọng (%/năm)</label>
                    <input type="number" step="0.1" className="input" value={form.expectedReturnPct} onChange={(e) => setForm({ ...form, expectedReturnPct: Number(e.target.value) || 10 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lạm phát (%/năm)</label>
                    <input type="number" step="0.1" className="input" value={form.inflationPct} onChange={(e) => setForm({ ...form, inflationPct: Number(e.target.value) || 3 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SWR (%/năm)</label>
                    <input type="number" step="0.1" className="input" value={form.swrPct} onChange={(e) => setForm({ ...form, swrPct: Number(e.target.value) || 4 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tăng thu nhập (%/năm)</label>
                    <input type="number" step="0.1" className="input" value={form.salaryGrowthPct} onChange={(e) => setForm({ ...form, salaryGrowthPct: Number(e.target.value) || 5 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chi tiêu mục tiêu khi FIRE (VNĐ/tháng)</label>
                    <input type="number" className="input" value={form.targetMonthlyExpenseAtFire} onChange={(e) => setForm({ ...form, targetMonthlyExpenseAtFire: Number(e.target.value) || 0 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mục tiêu đầu tư tối thiểu (VNĐ/tháng)</label>
                    <input type="number" className="input" value={form.plannedMonthlyInvest} onChange={(e) => setForm({ ...form, plannedMonthlyInvest: Number(e.target.value) || 0 })} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Khẩu vị rủi ro</label>
                    <select className="input" value={form.riskProfile} onChange={(e) => setForm({ ...form, riskProfile: e.target.value })} disabled={!isAdmin}>
                      <option value="capital_preservation">Bảo toàn vốn</option>
                      <option value="disciplined_growth">Tăng trưởng kỷ luật</option>
                      <option value="aggressive">Tấn công mạnh</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chế độ mục tiêu</label>
                    <select className="input" value={form.objectiveMode} onChange={(e) => setForm({ ...form, objectiveMode: e.target.value })} disabled={!isAdmin}>
                      <option value="fast_but_safe">Nhanh nhưng an toàn</option>
                      <option value="balanced">Cân bằng</option>
                      <option value="max_speed">Nhanh nhất</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kịch bản khi trượt KPI</label>
                    <select className="input" value={form.missedTargetPolicy} onChange={(e) => setForm({ ...form, missedTargetPolicy: e.target.value })} disabled={!isAdmin}>
                      <option value="cut_expense_first">Cắt chi trước</option>
                      <option value="invest_more_first">Tăng đầu tư bù trước</option>
                      <option value="extend_timeline_first">Giãn timeline trước</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nguồn lãi suất gửi</label>
                    <select className="input" value={form.depositRateSource} onChange={(e) => setForm({ ...form, depositRateSource: e.target.value })} disabled={!isAdmin}>
                      <option value="worldbank_vn">Auto (WorldBank VN)</option>
                      <option value="manual">Nhập tay</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lãi suất gửi nhập tay (%/năm)</label>
                    <input type="number" step="0.1" className="input" value={form.depositRateManual} onChange={(e) => setForm({ ...form, depositRateManual: Number(e.target.value) || 0 })} disabled={!isAdmin} />
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <h4 className="text-sm font-semibold">Phân bổ thu nhập / đầu tư (tổng 100%)</h4>
                  <div className="space-y-2">
                    {alloc.map((b, i) => (
                      <div key={b.id || i} className="grid grid-cols-12 gap-2">
                        <input
                          className="input col-span-5"
                          value={b.name}
                          onChange={(e) => setAlloc((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                          disabled={!isAdmin}
                        />
                        <select
                          className="input col-span-4"
                          value={b.assetClass}
                          onChange={(e) => setAlloc((prev) => prev.map((x, idx) => (idx === i ? { ...x, assetClass: e.target.value } : x)))}
                          disabled={!isAdmin}
                        >
                          <option value="CASH">Tiền mặt</option>
                          <option value="STOCK">Cổ phiếu</option>
                          <option value="GOLD">Vàng</option>
                          <option value="CRYPTO">Crypto</option>
                          <option value="REAL_ESTATE">BĐS</option>
                          <option value="OTHER">Khác</option>
                        </select>
                        <input
                          type="number"
                          step="0.1"
                          className={`input col-span-3 ${Number(b.targetPct) > 25 || Number(b.targetPct) < 20 ? "border-[var(--danger)]" : ""}`}
                          value={b.targetPct}
                          onChange={(e) => setAlloc((prev) => prev.map((x, idx) => (idx === i ? { ...x, targetPct: Number(e.target.value) || 0 } : x)))}
                          disabled={!isAdmin}
                        />
                      </div>
                    ))}
                  </div>
                  <div className={`text-xs font-semibold ${Math.abs(allocTotal - 100) > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                    Tổng phân bổ: {allocTotal.toFixed(1)}% (khuyến nghị mỗi danh mục 20-25%)
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setIsSettingsOpen(false)} className="btn btn-ghost border border-[var(--border)]">
                    Đóng
                  </button>
                  <button onClick={saveFireConfig} disabled={savingConfig || !isAdmin} className="btn btn-primary">
                    {savingConfig ? "Đang lưu..." : "Lưu FIRE Control"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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

function MiniStat({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-1">
        <span>{label}</span>
        {hint ? (
          <span title={hint} className="inline-flex items-center text-[var(--text-muted)] cursor-help">
            <CircleHelp size={13} />
          </span>
        ) : null}
      </div>
      <div className={`text-sm font-bold ${valueClass || ""}`}>{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="skeleton h-24 w-full"></div>;
}
