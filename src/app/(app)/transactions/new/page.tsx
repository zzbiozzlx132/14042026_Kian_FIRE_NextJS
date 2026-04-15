"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Check } from "lucide-react";
import { cn, formatAmountDisplay, parseAmount, today } from "@/lib/utils";

export default function NewTransactionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE");
  
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [essential, setEssential] = useState<"ESSENTIAL" | "NON_ESSENTIAL">("NON_ESSENTIAL");
  const [rating, setRating] = useState<"WORTHY" | "NORMAL" | "WASTEFUL">("NORMAL");

  // Mock data for lists, typically you would fetch these from /api/categories & /api/accounts
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    // Fetch mock categories and accounts
    fetch("/api/categories").then(r => r.json()).then(data => {
      if(Array.isArray(data)) setCategories(data);
    }).catch(e => console.log("Failed to fetch categories, using dev fallback"));
    
    fetch("/api/accounts").then(r => r.json()).then(data => {
      if(Array.isArray(data)) setAccounts(data);
    }).catch(e => console.log("Failed to fetch accounts"));
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseAmount(raw);
    setAmountRaw(formatAmountDisplay(num));
  };

  const handleQuickAmount = (val: number) => {
    setAmountRaw(formatAmountDisplay(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(amountRaw);
    if (!amount || amount <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ");
      return;
    }
    if (type !== "TRANSFER" && !categoryId) {
      toast.error("Vui lòng chọn hạng mục");
      return;
    }
    if ((type === "EXPENSE" || type === "TRANSFER") && !fromAccountId) {
      toast.error("Vui lòng chọn nguồn tiền");
      return;
    }
    if ((type === "INCOME" || type === "TRANSFER") && !toAccountId) {
      toast.error("Vui lòng chọn đích đến");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount,
          date,
          categoryId,
          // INCOME: fromAccountId = tài khoản nhận (match dashboard calculation)
          // EXPENSE: fromAccountId = nguồn tiền
          // TRANSFER: cả hai
          fromAccountId: type === "INCOME" ? toAccountId : (fromAccountId || undefined),
          toAccountId: type === "TRANSFER" ? (toAccountId || undefined) : undefined,
          description,
          essential: type === "EXPENSE" ? essential : undefined,
          rating: type === "EXPENSE" ? rating : undefined,
        }),
      });

      if (!res.ok) throw new Error("API failed");

      toast.success("Đã lưu giao dịch");
      router.push("/transactions");
      router.refresh();
    } catch (error) {
      toast.error("Lỗi khi lưu giao dịch. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--accent)] font-medium">
          ← Quay lại
        </button>
        <h1 className="text-xl font-bold tracking-tight">Thêm giao dịch mới</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type selector */}
        <div className="card p-2 flex gap-2">
          <button
            type="button"
            onClick={() => setType("EXPENSE")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all",
              type === "EXPENSE" ? "bg-[var(--danger-bg)] text-[var(--danger)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-input)]"
            )}
          >
            <ArrowDownCircle size={18} />
            Chi tiêu
          </button>
          <button
            type="button"
            onClick={() => setType("INCOME")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all",
              type === "INCOME" ? "bg-[var(--success-bg)] text-[var(--success)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-input)]"
            )}
          >
            <ArrowUpCircle size={18} />
            Thu nhập
          </button>
          <button
            type="button"
            onClick={() => setType("TRANSFER")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all",
              type === "TRANSFER" ? "bg-[var(--info-bg)] text-[var(--info)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-input)]"
            )}
          >
            <ArrowLeftRight size={18} />
            Chuyển tiền
          </button>
        </div>

        {/* Amount */}
        <div className="card">
          <div className="form-group mb-0">
            <label className="form-label">Số tiền (VNĐ)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full text-3xl font-bold bg-transparent outline-none py-2 text-[var(--accent)] placeholder-[var(--text-muted)]"
              placeholder="0"
              value={amountRaw}
              onChange={handleAmountChange}
              autoFocus
            />
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            {[10000, 50000, 100000, 200000, 500000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmount(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)] transition-colors"
              >
                +{val / 1000}k
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="form-group">
              <label className="form-label">Ngày giao dịch</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {type !== "TRANSFER" && (
              <div className="form-group">
                <label className="form-label">Hạng mục</label>
                <select
                  className="input font-medium"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Chọn hạng mục --</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {/* Fallback if no db data */}
                  {filteredCategories.length === 0 && (
                      <option value="test_cat">Vui lòng tạo mục trong Cài đặt</option>
                  )}
                </select>
              </div>
            )}

            {(type === "EXPENSE" || type === "TRANSFER") && (
              <div className="form-group">
                <label className="form-label">Từ nguồn tiền</label>
                <select
                  className="input"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                >
                  <option value="">-- Chọn tài khoản/Ví --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(type === "INCOME" || type === "TRANSFER") && (
              <div className="form-group">
                <label className="form-label">Đến nguồn tiền (Nhận)</label>
                <select
                  className="input"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">-- Chọn tài khoản/Ví --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card flex flex-col">
            <div className="form-group flex-1">
              <label className="form-label">Ghi chú (Tùy chọn)</label>
              <textarea
                className="input h-full min-h-[120px]"
                placeholder="Ăn trưa, mua sắm..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {type === "EXPENSE" && (
              <div className="mt-4 space-y-4 pt-4 border-t border-[var(--border)]">
                <div>
                  <label className="form-label">Phân loại tính chất</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEssential("ESSENTIAL")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-semibold border transition-all",
                        essential === "ESSENTIAL" ? "bg-[var(--info-bg)] border-[var(--info)] text-[var(--info)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                      )}
                    >
                      Thiết yếu
                    </button>
                    <button
                      type="button"
                      onClick={() => setEssential("NON_ESSENTIAL")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-semibold border transition-all",
                        essential === "NON_ESSENTIAL" ? "bg-[var(--warning-bg)] border-[var(--warning)] text-[var(--warning)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                      )}
                    >
                      Không thiết yếu
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Đánh giá độ xứng đáng</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRating("WORTHY")}
                      className={cn("flex-1 py-1 px-2 rounded hover:bg-[var(--bg-input)] text-xs text-center border transition-all", rating === "WORTHY" ? "border-[var(--success)] text-[var(--success)] font-bold" : "border-transparent text-[var(--text-muted)]")}
                    >Xứng đáng</button>
                    <button
                      type="button"
                      onClick={() => setRating("NORMAL")}
                      className={cn("flex-1 py-1 px-2 rounded hover:bg-[var(--bg-input)] text-xs text-center border transition-all", rating === "NORMAL" ? "border-[var(--info)] text-[var(--info)] font-bold" : "border-transparent text-[var(--text-muted)]")}
                    >Bình thường</button>
                    <button
                      type="button"
                      onClick={() => setRating("WASTEFUL")}
                      className={cn("flex-1 py-1 px-2 rounded hover:bg-[var(--bg-input)] text-xs text-center border transition-all", rating === "WASTEFUL" ? "border-[var(--danger)] text-[var(--danger)] font-bold" : "border-transparent text-[var(--text-muted)]")}
                    >Phí tiền</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-4 text-base mt-8 shadow-lg shadow-[var(--accent-muted)]"
        >
          {loading ? "Đang xử lý..." : (
            <>
              <Check size={20} />
              Lưu Giao Dịch
            </>
          )}
        </button>
      </form>
    </div>
  );
}
