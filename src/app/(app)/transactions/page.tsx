"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, ReceiptText, AlertTriangle, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate, parseAmount, formatAmountDisplay, today } from "@/lib/utils";
import { cn } from "@/lib/utils";

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : today();
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit
  const [editTx, setEditTx] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [editType, setEditType] = useState<"EXPENSE"|"INCOME"|"TRANSFER">("EXPENSE");
  const [editAmountRaw, setEditAmountRaw] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editFromAccountId, setEditFromAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEssential, setEditEssential] = useState<"ESSENTIAL"|"NON_ESSENTIAL">("NON_ESSENTIAL");
  const [editRating, setEditRating] = useState<"WORTHY"|"NORMAL"|"WASTEFUL">("NORMAL");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetch("/api/transactions")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTransactions(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d); });
    fetch("/api/accounts").then(r => r.json()).then(d => { if (Array.isArray(d)) setAccounts(d); });
  }, []);

  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(s) ||
      tx.category?.name?.toLowerCase().includes(s)
    );
  });

  const openEdit = (tx: any) => {
    setEditTx(tx);
    setEditType(tx.type);
    setEditAmountRaw(formatAmountDisplay(tx.amount));
    setEditDate(toDateInput(tx.date));
    setEditCategoryId(tx.categoryId || "");
    setEditFromAccountId(tx.fromAccountId || "");
    setEditToAccountId(tx.toAccountId || "");
    setEditDescription(tx.description || "");
    setEditEssential(tx.essential || "NON_ESSENTIAL");
    setEditRating(tx.rating || "NORMAL");
  };

  const handleSaveEdit = async () => {
    if (!editTx) return;
    const amount = parseAmount(editAmountRaw);
    if (!amount || amount <= 0) { toast.error("Số tiền không hợp lệ"); return; }
    setEditSaving(true);
    const res = await fetch(`/api/transactions/${editTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editType,
        amount,
        date: editDate,
        categoryId: editCategoryId || null,
        fromAccountId: (editType === "EXPENSE" || editType === "TRANSFER") ? (editFromAccountId || null) : null,
        toAccountId: (editType === "INCOME" || editType === "TRANSFER") ? (editToAccountId || null) : null,
        description: editDescription,
        essential: editType === "EXPENSE" ? editEssential : null,
        rating: editType === "EXPENSE" ? editRating : null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
      toast.success("Đã cập nhật giao dịch");
      setEditTx(null);
    } else {
      toast.error("Cập nhật thất bại");
    }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/transactions/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setTransactions(prev => prev.filter(t => t.id !== deleteId));
      toast.success("Đã xoá giao dịch");
    } else {
      toast.error("Xoá thất bại");
    }
    setDeleteId(null);
  };

  const filteredCats = categories.filter(c => c.type === editType);

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Giao dịch</h1>
          <p className="text-sm text-[var(--text-muted)]">{transactions.length} giao dịch</p>
        </div>
        <Link href="/transactions/new" className="btn btn-primary">
          <Plus size={18} /> Thêm mới
        </Link>
      </div>

      {/* Search */}
      <div className="card mb-6 p-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo ghi chú, hạng mục..."
            className="input w-full"
            style={{ paddingLeft: "44px" }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="card p-4"><div className="skeleton h-12 w-full"></div></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card min-h-[300px] flex items-center justify-center border-dashed">
          <div className="text-center">
            <div className="w-14 h-14 bg-[var(--bg-input)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
              <ReceiptText size={24} />
            </div>
            <p className="text-[var(--text-muted)] font-medium mb-3">
              {search ? "Không tìm thấy giao dịch" : "Chưa có giao dịch nào"}
            </p>
            <Link href="/transactions/new" className="text-[var(--accent)] font-semibold text-sm hover:underline">
              + Thêm giao dịch đầu tiên
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => (
            <div key={tx.id} className="card py-3 px-4 flex items-center gap-4 group hover:border-[var(--accent)] transition-colors">
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                tx.type === "INCOME" ? "bg-emerald-50 text-emerald-600" :
                tx.type === "EXPENSE" ? "bg-red-50 text-red-600" :
                "bg-blue-50 text-blue-600"
              }`}>
                {tx.type === "INCOME" ? <ArrowDownRight size={18} /> :
                 tx.type === "EXPENSE" ? <ArrowUpRight size={18} /> :
                 <ArrowLeftRight size={18} />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">
                    {tx.description || tx.category?.name || "Giao dịch"}
                  </span>
                  {tx.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] font-medium">
                      {tx.category.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {fmtDate(tx.date)}
                  {tx.fromAccount && ` · ${tx.fromAccount.name}`}
                  {tx.type === "TRANSFER" && tx.toAccount && ` → ${tx.toAccount.name}`}
                </div>
              </div>

              {/* Amount + badges */}
              <div className="text-right flex-shrink-0">
                <div className={`font-bold text-sm ${
                  tx.type === "INCOME" ? "text-[var(--success)]" :
                  tx.type === "EXPENSE" ? "text-[var(--danger)]" :
                  "text-[var(--info)]"
                }`}>
                  {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}{fmtMoney(tx.amount)}
                </div>
                {(tx.essential || tx.rating) && (
                  <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
                    {tx.essential === "ESSENTIAL" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Thiết yếu</span>
                    )}
                    {tx.essential === "NON_ESSENTIAL" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] font-medium">Không TY</span>
                    )}
                    {tx.rating === "WORTHY" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Xứng đáng</span>
                    )}
                    {tx.rating === "WASTEFUL" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Phí tiền</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                <button
                  onClick={() => openEdit(tx)}
                  className="text-[var(--text-muted)] hover:text-[var(--accent)] p-1.5 rounded-lg hover:bg-[var(--accent-muted)] transition-colors"
                  title="Sửa"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteId(tx.id)}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Xoá"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTx && (
        <div className="modal-overlay" onClick={() => setEditTx(null)}>
          <div className="modal-content max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base">Sửa giao dịch</h3>
              <button onClick={() => setEditTx(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>

            {/* Type */}
            <div className="flex gap-2 p-1 bg-[var(--bg-input)] rounded-xl mb-4">
              {(["EXPENSE","INCOME","TRANSFER"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEditType(t)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                    editType === t
                      ? t === "EXPENSE" ? "bg-white text-[var(--danger)] shadow-sm"
                        : t === "INCOME" ? "bg-white text-[var(--success)] shadow-sm"
                        : "bg-white text-[var(--info)] shadow-sm"
                      : "text-[var(--text-muted)]"
                  )}
                >
                  {t === "EXPENSE" ? "Chi tiêu" : t === "INCOME" ? "Thu nhập" : "Chuyển tiền"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {/* Amount */}
              <div>
                <label className="form-label">Số tiền</label>
                <input
                  className="input text-lg font-bold"
                  value={editAmountRaw}
                  onChange={e => setEditAmountRaw(formatAmountDisplay(parseAmount(e.target.value)))}
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>

              {/* Date + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ngày</label>
                  <input type="date" className="input" value={editDate} onChange={e => setEditDate(e.target.value)} />
                </div>
                {editType !== "TRANSFER" && (
                  <div>
                    <label className="form-label">Hạng mục</label>
                    <select className="input" value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>
                      <option value="">-- Hạng mục --</option>
                      {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Accounts */}
              {(editType === "EXPENSE" || editType === "TRANSFER") && (
                <div>
                  <label className="form-label">Từ tài khoản</label>
                  <select className="input" value={editFromAccountId} onChange={e => setEditFromAccountId(e.target.value)}>
                    <option value="">-- Chọn tài khoản --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {(editType === "INCOME" || editType === "TRANSFER") && (
                <div>
                  <label className="form-label">Đến tài khoản</label>
                  <select className="input" value={editToAccountId} onChange={e => setEditToAccountId(e.target.value)}>
                    <option value="">-- Chọn tài khoản --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="form-label">Ghi chú</label>
                <input className="input" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Mô tả giao dịch..." />
              </div>

              {/* Essential + Rating (EXPENSE only) */}
              {editType === "EXPENSE" && (
                <div className="pt-2 border-t border-[var(--border)] space-y-3">
                  <div>
                    <label className="form-label">Tính chất</label>
                    <div className="flex gap-2">
                      {(["ESSENTIAL","NON_ESSENTIAL"] as const).map(v => (
                        <button key={v} onClick={() => setEditEssential(v)}
                          className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            editEssential === v
                              ? v === "ESSENTIAL" ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-[var(--bg-input)] border-[var(--text-muted)] text-[var(--text-secondary)]"
                              : "border-[var(--border)] text-[var(--text-muted)]"
                          )}>
                          {v === "ESSENTIAL" ? "Thiết yếu" : "Không thiết yếu"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Đánh giá</label>
                    <div className="flex gap-2">
                      {([["WORTHY","Xứng đáng","text-emerald-700 border-emerald-400 bg-emerald-50"],["NORMAL","Bình thường","text-[var(--info)] border-[var(--info)] bg-[var(--info-bg)]"],["WASTEFUL","Phí tiền","text-red-700 border-red-400 bg-red-50"]] as const).map(([v, label, cls]) => (
                        <button key={v} onClick={() => setEditRating(v as any)}
                          className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            editRating === v ? cls : "border-[var(--border)] text-[var(--text-muted)]"
                          )}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTx(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn btn-primary flex-1">
                {editSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold">Xác nhận xoá</h3>
                <p className="text-sm text-[var(--text-muted)]">Giao dịch này sẽ bị xoá vĩnh viễn.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleDelete} className="btn flex-1 bg-[var(--danger)] text-white hover:opacity-90">Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
