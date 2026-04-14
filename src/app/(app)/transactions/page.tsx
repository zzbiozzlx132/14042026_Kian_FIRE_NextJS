"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, ReceiptText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/utils";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/transactions")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTransactions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(s) ||
      tx.category?.name?.toLowerCase().includes(s)
    );
  });

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
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo ghi chú, hạng mục..."
            className="input w-full pl-10"
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

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <div className={`font-bold text-sm ${
                  tx.type === "INCOME" ? "text-[var(--success)]" :
                  tx.type === "EXPENSE" ? "text-[var(--danger)]" :
                  "text-[var(--info)]"
                }`}>
                  {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}{fmtMoney(tx.amount)}
                </div>
                {tx.essential && (
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {tx.essential === "ESSENTIAL" ? "Thiết yếu" : "Không thiết yếu"}
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => setDeleteId(tx.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] p-1 transition-all"
                title="Xoá"
              >
                ×
              </button>
            </div>
          ))}
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
