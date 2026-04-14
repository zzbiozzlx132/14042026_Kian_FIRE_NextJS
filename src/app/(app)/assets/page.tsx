"use client";

import { useState, useEffect } from "react";
import { Plus, Wallet, TrendingUp, ArrowDownRight, Trash2, Pencil, X } from "lucide-react";
import { fmtMoney, fmtMoneyCompact, fmtDate, ACCOUNT_TYPE_LABELS } from "@/lib/utils";
import { toast } from "sonner";

const INV_TYPE_LABELS: Record<string, string> = {
  GOLD: "Vàng", STOCK: "Cổ phiếu", CRYPTO: "Crypto",
  REAL_ESTATE: "Bất động sản", TERM_DEPOSIT: "Tiết kiệm kỳ hạn", OTHER: "Khác",
};

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);

  useEffect(() => {
    fetch("/api/accounts").then(r => r.json()).then(d => { if (Array.isArray(d)) setAccounts(d); });
    fetch("/api/investments").then(r => r.json()).then(d => { if (Array.isArray(d)) setInvestments(d); });
  }, []);

  const totalInvested = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
  const totalCurrentValue = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
  const totalPnL = totalCurrentValue - totalInvested;

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tài sản & Đầu tư</h1>
        <button onClick={() => activeTab === "investments" ? setShowInvModal(true) : setShowAddModal(true)} className="btn btn-primary">
          <Plus size={18} /> Thêm mới
        </button>
      </div>

      <div className="tab-bar inline-flex mb-6">
        {[
          { id: "accounts", icon: Wallet, label: "Tài khoản/Ví" },
          { id: "investments", icon: TrendingUp, label: `Đầu tư (${investments.length})` },
          { id: "debts", icon: ArrowDownRight, label: "Vay / Nợ" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item flex items-center gap-2 ${activeTab === tab.id ? "active" : ""}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ ACCOUNTS TAB ═══ */}
      {activeTab === "accounts" && (
        <div>
          {accounts.length === 0 ? (
            <EmptyState text="Chưa có tài khoản. Bấm Thêm mới để tạo." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(acc => (
                <div key={acc.id} className="card p-5 hover:border-[var(--accent)] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      acc.type === "CREDIT_CARD" ? "bg-red-50 text-red-600" :
                      acc.type === "E_WALLET" ? "bg-purple-50 text-purple-600" :
                      acc.type === "SAVINGS" ? "bg-amber-50 text-amber-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      <Wallet size={20} />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] uppercase tracking-wider">
                      {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{acc.name}</h3>
                  <div className="text-2xl font-bold">{fmtMoney(acc.initialBalance)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ INVESTMENTS TAB ═══ */}
      {activeTab === "investments" && (
        <div>
          {/* Summary */}
          {investments.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Tổng vốn</div>
                <div className="text-lg font-bold">{fmtMoneyCompact(totalInvested)}</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Giá trị hiện tại</div>
                <div className="text-lg font-bold">{fmtMoneyCompact(totalCurrentValue)}</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Lãi/Lỗ</div>
                <div className={`text-lg font-bold ${totalPnL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {totalPnL >= 0 ? "+" : ""}{fmtMoneyCompact(totalPnL)}
                </div>
              </div>
            </div>
          )}

          {investments.length === 0 ? (
            <EmptyState text="Chưa có khoản đầu tư. Bấm Thêm mới để bắt đầu." />
          ) : (
            <div className="space-y-3">
              {investments.map(inv => {
                const cost = inv.buyPrice * inv.quantity;
                const value = inv.currentPrice * inv.quantity;
                const pnl = value - cost;
                const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
                return (
                  <div key={inv.id} className="card py-4 px-5 flex items-center gap-4 group hover:border-[var(--accent)] transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      inv.type === "GOLD" ? "bg-yellow-50 text-yellow-600" :
                      inv.type === "STOCK" ? "bg-blue-50 text-blue-600" :
                      inv.type === "CRYPTO" ? "bg-purple-50 text-purple-600" :
                      inv.type === "TERM_DEPOSIT" ? "bg-emerald-50 text-emerald-600" :
                      "bg-gray-50 text-gray-600"
                    }`}>
                      <TrendingUp size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{inv.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] font-medium">
                          {INV_TYPE_LABELS[inv.type] || inv.type}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {inv.quantity > 1 ? `${inv.quantity} × ` : ""}{fmtMoney(inv.buyPrice)} → {fmtMoney(inv.currentPrice)}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm">{fmtMoney(value)}</div>
                      <div className={`text-xs font-semibold ${pnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {pnl >= 0 ? "+" : ""}{fmtMoneyCompact(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setEditInv(inv)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent)]" title="Cập nhật giá">
                        <Pencil size={14} />
                      </button>
                      <button onClick={async () => {
                        if (!confirm("Xoá khoản đầu tư này?")) return;
                        const res = await fetch(`/api/investments/${inv.id}`, { method: "DELETE" });
                        if (res.ok) { setInvestments(prev => prev.filter(i => i.id !== inv.id)); toast.success("Đã xoá"); }
                      }} className="p-1.5 rounded-lg hover:bg-[var(--danger-bg)] text-[var(--text-muted)] hover:text-[var(--danger)]" title="Xoá">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ DEBTS TAB ═══ */}
      {activeTab === "debts" && <EmptyState text="Chức năng quản lý nợ sẽ sớm được bổ sung." />}

      {/* ═══ ADD ACCOUNT MODAL ═══ */}
      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} onCreated={(acc: any) => { setAccounts(prev => [...prev, acc]); setShowAddModal(false); }} />}

      {/* ═══ ADD INVESTMENT MODAL ═══ */}
      {showInvModal && <AddInvestmentModal onClose={() => setShowInvModal(false)} onCreated={(inv: any) => { setInvestments(prev => [inv, ...prev]); setShowInvModal(false); }} />}

      {/* ═══ EDIT INVESTMENT MODAL ═══ */}
      {editInv && <EditInvestmentModal inv={editInv} onClose={() => setEditInv(null)} onUpdated={(updated: any) => {
        setInvestments(prev => prev.map(i => i.id === updated.id ? updated : i));
        setEditInv(null);
      }} />}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card min-h-[250px] flex items-center justify-center border-dashed">
      <p className="text-[var(--text-muted)] text-sm text-center">{text}</p>
    </div>
  );
}

/* ═══ ADD ACCOUNT MODAL ═══ */
function AddAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (acc: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("BANK");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) { toast.error("Vui lòng nhập tên tài khoản"); return; }
    setLoading(true);
    const res = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, initialBalance: parseFloat(balance) || 0 }) });
    if (res.ok) { toast.success("Đã thêm tài khoản"); onCreated(await res.json()); }
    else toast.error("Thêm thất bại");
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Thêm tài khoản</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
        </div>
        <div className="form-group"><label className="form-label">Tên</label><input className="input" placeholder="VD: Vietcombank" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Loại</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="CASH">Tiền mặt</option><option value="BANK">Ngân hàng</option>
            <option value="E_WALLET">Ví điện tử</option><option value="CREDIT_CARD">Thẻ tín dụng</option>
            <option value="SAVINGS">Tiết kiệm</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Số dư ban đầu (VNĐ)</label><input className="input" type="number" placeholder="0" value={balance} onChange={e => setBalance(e.target.value)} /></div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang tạo..." : "Tạo tài khoản"}</button></div>
      </div>
    </div>
  );
}

/* ═══ ADD INVESTMENT MODAL ═══ */
function AddInvestmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: any) => void }) {
  const [form, setForm] = useState({ name: "", type: "STOCK", buyPrice: "", currentPrice: "", quantity: "1", note: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.buyPrice) { toast.error("Nhập tên và giá mua"); return; }
    setLoading(true);
    const res = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, buyPrice: parseFloat(form.buyPrice), currentPrice: parseFloat(form.currentPrice || form.buyPrice), quantity: parseFloat(form.quantity) || 1 }) });
    if (res.ok) { toast.success("Đã thêm khoản đầu tư"); onCreated(await res.json()); }
    else toast.error("Thêm thất bại");
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Thêm khoản đầu tư</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2"><label className="form-label">Tên khoản đầu tư</label>
            <input className="input" placeholder="VD: VNINDEX ETF, Vàng SJC..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Loại</label>
            <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="STOCK">Cổ phiếu</option><option value="GOLD">Vàng</option>
              <option value="CRYPTO">Crypto</option><option value="TERM_DEPOSIT">Tiết kiệm kỳ hạn</option>
              <option value="REAL_ESTATE">Bất động sản</option><option value="OTHER">Khác</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Số lượng</label>
            <input className="input" type="number" step="any" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Giá mua (VNĐ)</label>
            <input className="input" type="number" placeholder="0" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Giá hiện tại (VNĐ)</label>
            <input className="input" type="number" placeholder="Bằng giá mua" value={form.currentPrice} onChange={e => setForm({...form, currentPrice: e.target.value})} />
          </div>
          <div className="form-group col-span-2"><label className="form-label">Ghi chú</label>
            <input className="input" placeholder="Tuỳ chọn" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
          </div>
        </div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang tạo..." : "Thêm đầu tư"}</button></div>
      </div>
    </div>
  );
}

/* ═══ EDIT INVESTMENT MODAL ═══ */
function EditInvestmentModal({ inv, onClose, onUpdated }: { inv: any; onClose: () => void; onUpdated: (inv: any) => void }) {
  const [currentPrice, setCurrentPrice] = useState(inv.currentPrice.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const res = await fetch(`/api/investments/${inv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPrice: parseFloat(currentPrice) }) });
    if (res.ok) { toast.success("Đã cập nhật giá"); onUpdated(await res.json()); }
    else toast.error("Cập nhật thất bại");
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Cập nhật giá: {inv.name}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
        </div>
        <div className="text-sm text-[var(--text-muted)] mb-4">Giá mua: {fmtMoney(inv.buyPrice)} × {inv.quantity}</div>
        <div className="form-group"><label className="form-label">Giá hiện tại (VNĐ)</label>
          <input className="input text-xl font-bold" type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} autoFocus />
        </div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang lưu..." : "Cập nhật"}</button></div>
      </div>
    </div>
  );
}
