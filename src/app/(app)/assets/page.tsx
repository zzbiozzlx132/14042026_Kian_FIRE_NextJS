"use client";

import { useState, useEffect } from "react";
import { Plus, Wallet, TrendingUp, ArrowDownRight, Trash2, Pencil, X, AlertTriangle } from "lucide-react";
import { fmtMoney, fmtDate, ACCOUNT_TYPE_LABELS, parseAmount } from "@/lib/utils";
import { toast } from "sonner";
import { MoneyInput } from "@/components/ui/money-input";

const INV_TYPE_LABELS: Record<string, string> = {
  GOLD: "Vàng", STOCK: "Cổ phiếu", CRYPTO: "Crypto",
  REAL_ESTATE: "Bất động sản", TERM_DEPOSIT: "Tiết kiệm kỳ hạn", OTHER: "Khác",
};

const INV_UNIT: Record<string, string> = {
  GOLD: "chỉ", STOCK: "cổ phiếu", CRYPTO: "coin", REAL_ESTATE: "BĐS", TERM_DEPOSIT: "sổ", OTHER: "đơn vị",
};

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [sellTarget, setSellTarget] = useState<any>(null);

  useEffect(() => {
    fetch("/api/accounts").then(r => r.json()).then(d => { if (Array.isArray(d)) setAccounts(d); });
    fetch("/api/investments").then(r => r.json()).then(d => { if (Array.isArray(d)) setInvestments(d); });
  }, []);

  const holdingInvestments = investments.filter(i => i.status === "holding");
  const soldInvestments = investments.filter(i => i.status === "sold");
  const totalInvested = holdingInvestments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
  const totalCurrentValue = holdingInvestments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
  const totalPnL = totalCurrentValue - totalInvested;

  const handleDeleteInvestment = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget._type === "account") {
        const res = await fetch(`/api/accounts?id=${deleteTarget.id}`, { method: "DELETE" });
        if (res.ok) {
          setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id));
          toast.success("Đã xoá tài khoản");
        } else {
          const data = await res.json();
          toast.error(data.error || "Xoá thất bại");
        }
      } else {
        const res = await fetch(`/api/investments/${deleteTarget.id}`, { method: "DELETE" });
        if (res.ok) {
          setInvestments(prev => prev.filter(i => i.id !== deleteTarget.id));
          toast.success("Đã xoá khoản đầu tư");
        } else {
          const data = await res.json();
          toast.error(data.error || "Xoá thất bại");
        }
      }
    } catch {
      toast.error("Lỗi kết nối");
    }
    setDeleteTarget(null);
  };

  const handleSellComplete = (result: { holding: any; sold: any }) => {
    setInvestments(prev => {
      let updated = [...prev];
      if (result.holding) {
        updated = updated.map(i => i.id === result.holding.id ? result.holding : i);
      } else {
        // Sold all - remove the holding
        updated = updated.filter(i => i.id !== sellTarget?.id);
      }
      if (result.sold) updated.push(result.sold);
      return updated;
    });
    setSellTarget(null);
  };

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
          { id: "investments", icon: TrendingUp, label: `Đầu tư (${holdingInvestments.length})` },
          { id: "debts", icon: ArrowDownRight, label: "Vay / Nợ" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`tab-item flex items-center gap-2 ${activeTab === tab.id ? "active" : ""}`}>
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
                <div key={acc.id} className="card p-5 hover:border-[var(--accent)] transition-colors group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      acc.type === "CREDIT_CARD" ? "bg-red-50 text-red-600" :
                      acc.type === "E_WALLET" ? "bg-purple-50 text-purple-600" :
                      acc.type === "SAVINGS" ? "bg-amber-50 text-amber-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      <Wallet size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] uppercase tracking-wider">
                        {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                      </span>
                      <button onClick={async () => {
                        setDeleteTarget({ ...acc, _type: "account" });
                      }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all" title="Xoá">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
          {/* Summary Cards */}
          {holdingInvestments.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Tổng vốn đầu tư</div>
                <div className="text-lg font-bold">{fmtMoney(totalInvested)}</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Giá trị hiện tại</div>
                <div className="text-lg font-bold">{fmtMoney(totalCurrentValue)}</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Tổng Lãi/Lỗ</div>
                <div className={`text-lg font-bold ${totalPnL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {totalPnL >= 0 ? "+" : ""}{fmtMoney(totalPnL)}
                </div>
              </div>
            </div>
          )}

          {/* Holding Investments */}
          {holdingInvestments.length === 0 ? (
            <EmptyState text="Chưa có khoản đầu tư nào. Bấm Thêm mới để bắt đầu." />
          ) : (
            <div className="space-y-3">
              {holdingInvestments.map(inv => <InvestmentCard key={inv.id} inv={inv}
                onEdit={() => setEditInv(inv)} onDelete={() => setDeleteTarget(inv)} onSell={() => setSellTarget(inv)} />)}
            </div>
          )}

          {/* Sold Investments */}
          {soldInvestments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Đã bán / Đã tất toán</h3>
              <div className="space-y-2">
                {soldInvestments.map(inv => <InvestmentCard key={inv.id} inv={inv} sold
                  onEdit={() => setEditInv(inv)} onDelete={() => setDeleteTarget(inv)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DEBTS TAB ═══ */}
      {activeTab === "debts" && <EmptyState text="Chức năng quản lý nợ sẽ sớm được bổ sung." />}

      {/* ═══ MODALS ═══ */}
      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} onCreated={(acc: any) => { setAccounts(prev => [...prev, acc]); setShowAddModal(false); }} />}
      {showInvModal && <AddInvestmentModal onClose={() => setShowInvModal(false)} onCreated={(inv: any) => { setInvestments(prev => [inv, ...prev]); setShowInvModal(false); }} />}
      {editInv && <EditInvestmentModal inv={editInv} onClose={() => setEditInv(null)} onUpdated={(updated: any) => { setInvestments(prev => prev.map(i => i.id === updated.id ? updated : i)); setEditInv(null); }} />}
      {sellTarget && <SellInvestmentModal inv={sellTarget} onClose={() => setSellTarget(null)} onSold={handleSellComplete} />}

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold">Xác nhận xoá</h3>
                <p className="text-sm text-[var(--text-muted)]">Xoá &quot;{deleteTarget.name}&quot;?</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Hành động này không thể hoàn tác. Dữ liệu lãi/lỗ của khoản đầu tư sẽ bị xoá vĩnh viễn.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleDeleteInvestment} className="btn flex-1 bg-[var(--danger)] text-white hover:opacity-90">Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ INVESTMENT CARD ═══ */
function InvestmentCard({ inv, sold, onEdit, onDelete, onSell }: {
  inv: any; sold?: boolean; onEdit: () => void; onDelete: () => void; onSell?: () => void;
}) {
  const cost = inv.buyPrice * inv.quantity;
  const value = inv.currentPrice * inv.quantity;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
  const unit = INV_UNIT[inv.type] || "đơn vị";

  return (
    <div className={`card p-5 group transition-colors ${sold ? "opacity-60" : "hover:border-[var(--accent)]"}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          inv.type === "GOLD" ? "bg-yellow-50 text-yellow-600" :
          inv.type === "STOCK" ? "bg-blue-50 text-blue-600" :
          inv.type === "CRYPTO" ? "bg-purple-50 text-purple-600" :
          inv.type === "TERM_DEPOSIT" ? "bg-emerald-50 text-emerald-600" :
          inv.type === "REAL_ESTATE" ? "bg-orange-50 text-orange-600" :
          "bg-gray-50 text-gray-600"
        }`}>
          <TrendingUp size={18} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-sm">{inv.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] font-semibold uppercase">
              {INV_TYPE_LABELS[inv.type] || inv.type}
            </span>
            {sold && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">Đã bán</span>}
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Khối lượng</span>
              <div className="font-semibold">{inv.quantity} {unit}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Giá mua</span>
              <div className="font-semibold">{fmtMoney(inv.buyPrice)}/{unit}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Giá hiện tại</span>
              <div className="font-semibold">{fmtMoney(inv.currentPrice)}/{unit}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Tổng vốn</span>
              <div className="font-semibold">{fmtMoney(cost)}</div>
            </div>
          </div>

          {inv.note && <div className="text-xs text-[var(--text-muted)] mt-2 italic">{inv.note}</div>}
        </div>

        {/* Right: Value + PnL + Actions */}
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-base">{fmtMoney(value)}</div>
          <div className={`text-xs font-semibold ${pnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}
            <span className="ml-1">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
          </div>

          {/* Actions */}
          <div className="flex gap-1 mt-3 justify-end opacity-0 group-hover:opacity-100 transition-all">
            {!sold && onSell && (
              <button onClick={onSell} className="text-[10px] px-2 py-1 rounded-lg bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-yellow-50 transition-colors font-medium">
                Bán
              </button>
            )}
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title="Sửa">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors" title="Xoá">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
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
      body: JSON.stringify({ name, type, initialBalance: parseAmount(balance) }) });
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
        <div className="form-group"><label className="form-label">Số dư ban đầu (VNĐ)</label><MoneyInput placeholder="0" value={balance} onChange={setBalance} /></div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang tạo..." : "Tạo tài khoản"}</button></div>
      </div>
    </div>
  );
}

/* ═══ ADD INVESTMENT MODAL ═══ */
function AddInvestmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: any) => void }) {
  const [form, setForm] = useState({ name: "", type: "GOLD", buyPrice: "", currentPrice: "", quantity: "1", note: "" });
  const [loading, setLoading] = useState(false);

  const unit = INV_UNIT[form.type] || "đơn vị";

  const handleSubmit = async () => {
    if (!form.name || !form.buyPrice) { toast.error("Nhập tên và giá mua"); return; }
    setLoading(true);
    const res = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, buyPrice: parseAmount(form.buyPrice), currentPrice: parseAmount(form.currentPrice || form.buyPrice), quantity: parseFloat(form.quantity) || 1 }) });
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
            <input className="input" placeholder={form.type === "GOLD" ? "VD: Vàng SJC 9999" : "VD: VNM, Bitcoin..."} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Loại đầu tư</label>
            <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="GOLD">🥇 Vàng</option><option value="STOCK">📈 Cổ phiếu</option>
              <option value="CRYPTO">₿ Crypto</option><option value="TERM_DEPOSIT">🏦 Tiết kiệm kỳ hạn</option>
              <option value="REAL_ESTATE">🏠 Bất động sản</option><option value="OTHER">📦 Khác</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Khối lượng ({unit})</label>
            <input className="input" type="number" step="any" min="0" placeholder="VD: 5" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Giá mua / {unit} (VNĐ)</label>
            <MoneyInput placeholder="VD: 9.200.000" value={form.buyPrice} onChange={val => setForm({...form, buyPrice: val})} />
          </div>
          <div className="form-group"><label className="form-label">Giá hiện tại / {unit} (VNĐ)</label>
            <MoneyInput placeholder="Bằng giá mua nếu bỏ trống" value={form.currentPrice} onChange={val => setForm({...form, currentPrice: val})} />
          </div>
          <div className="form-group col-span-2"><label className="form-label">Ghi chú (tuỳ chọn)</label>
            <input className="input" placeholder="VD: Mua tại SJC Q1" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
          </div>
        </div>

        {/* Preview */}
        {form.buyPrice && (
          <div className="mt-4 p-3 rounded-xl bg-[var(--bg-input)] text-xs space-y-1">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Tổng vốn</span><span className="font-bold">{fmtMoney((parseAmount(form.buyPrice)) * (parseFloat(form.quantity) || 1))}</span></div>
            {form.currentPrice && (
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Giá trị hiện tại</span><span className="font-bold">{fmtMoney((parseAmount(form.currentPrice)) * (parseFloat(form.quantity) || 1))}</span></div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang tạo..." : "Thêm đầu tư"}</button></div>
      </div>
    </div>
  );
}

/* ═══ EDIT INVESTMENT MODAL ═══ */
function EditInvestmentModal({ inv, onClose, onUpdated }: { inv: any; onClose: () => void; onUpdated: (inv: any) => void }) {
  const [currentPrice, setCurrentPrice] = useState(inv.currentPrice.toString());
  const [quantity, setQuantity] = useState(inv.quantity.toString());
  const [loading, setLoading] = useState(false);
  const unit = INV_UNIT[inv.type] || "đơn vị";

  const newValue = parseAmount(currentPrice) * (parseFloat(quantity) || 0);
  const cost = inv.buyPrice * (parseFloat(quantity) || inv.quantity);
  const pnl = newValue - cost;

  const handleSubmit = async () => {
    setLoading(true);
    const res = await fetch(`/api/investments/${inv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPrice: parseAmount(currentPrice), quantity: parseFloat(quantity) }) });
    if (res.ok) { toast.success("Đã cập nhật"); onUpdated(await res.json()); }
    else toast.error("Cập nhật thất bại");
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Cập nhật: {inv.name}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-input)] text-xs mb-4 space-y-1">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Loại</span><span className="font-semibold">{INV_TYPE_LABELS[inv.type]}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Giá mua</span><span className="font-semibold">{fmtMoney(inv.buyPrice)}/{unit}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group"><label className="form-label">Khối lượng ({unit})</label>
            <input className="input" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div className="form-group"><label className="form-label">Giá hiện tại / {unit}</label>
            <MoneyInput className="text-lg font-bold" value={currentPrice} onChange={setCurrentPrice} autoFocus />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-[var(--bg-input)] text-xs space-y-1">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Giá trị mới</span><span className="font-bold">{fmtMoney(newValue)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Lãi/Lỗ</span>
            <span className={`font-bold ${pnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button><button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">{loading ? "Đang lưu..." : "Cập nhật"}</button></div>
      </div>
    </div>
  );
}

/* ═══ SELL INVESTMENT MODAL ═══ */
function SellInvestmentModal({ inv, onClose, onSold }: { inv: any; onClose: () => void; onSold: (result: { holding: any; sold: any }) => void }) {
  const [quantitySold, setQuantitySold] = useState(inv.quantity.toString());
  const [sellPrice, setSellPrice] = useState(inv.currentPrice.toString());
  const [loading, setLoading] = useState(false);
  const unit = INV_UNIT[inv.type] || "đơn vị";

  const qty = parseFloat(quantitySold) || 0;
  const price = parseAmount(sellPrice);
  const totalSellValue = qty * price;
  const totalBuyCost = qty * inv.buyPrice;
  const pnl = totalSellValue - totalBuyCost;
  const remaining = inv.quantity - qty;
  const isPartial = remaining > 0;

  const handleSubmit = async () => {
    if (qty <= 0) { toast.error("Số lượng bán phải > 0"); return; }
    if (qty > inv.quantity) { toast.error(`Chỉ có ${inv.quantity} ${unit}`); return; }
    if (price <= 0) { toast.error("Giá bán phải > 0"); return; }

    setLoading(true);
    const res = await fetch(`/api/investments/${inv.id}/sell`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantitySold: qty, sellPrice: price }),
    });
    if (res.ok) {
      const result = await res.json();
      toast.success(isPartial ? `Đã bán ${qty} ${unit}, còn ${remaining} ${unit}` : "Đã bán toàn bộ");
      onSold(result);
    } else {
      const data = await res.json();
      toast.error(data.error || "Bán thất bại");
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Bán: {inv.name}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
        </div>

        {/* Current info */}
        <div className="p-3 rounded-xl bg-[var(--bg-input)] text-xs mb-4 space-y-1">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Đang nắm giữ</span><span className="font-bold">{inv.quantity} {unit}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Giá mua</span><span className="font-semibold">{fmtMoney(inv.buyPrice)}/{unit}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Tổng vốn</span><span className="font-semibold">{fmtMoney(inv.buyPrice * inv.quantity)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Số lượng bán ({unit})</label>
            <input className="input" type="number" step="any" min="0" max={inv.quantity}
              value={quantitySold} onChange={e => setQuantitySold(e.target.value)} autoFocus />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setQuantitySold(inv.quantity.toString())}
                className="text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent)] font-medium">Tất cả</button>
              <button type="button" onClick={() => setQuantitySold((inv.quantity / 2).toString())}
                className="text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent)] font-medium">50%</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Giá bán / {unit} (VNĐ)</label>
            <MoneyInput className="text-lg font-bold" value={sellPrice} onChange={setSellPrice} />
          </div>
        </div>

        {/* P&L Preview */}
        {qty > 0 && price > 0 && (
          <div className="mt-4 p-3 rounded-xl border border-[var(--border)] text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Tiền thu về</span><span className="font-bold text-sm">{fmtMoney(totalSellValue)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Vốn gốc ({qty} × {fmtMoney(inv.buyPrice)})</span><span className="font-semibold">{fmtMoney(totalBuyCost)}</span></div>
            <div className="border-t border-[var(--border)] my-1"></div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)] font-semibold">Lãi/Lỗ</span>
              <span className={`font-bold text-sm ${pnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)} ({((pnl / totalBuyCost) * 100).toFixed(1)}%)
              </span>
            </div>
            {isPartial && (
              <div className="flex justify-between pt-1 text-[var(--info)]">
                <span className="font-medium">Còn giữ lại</span>
                <span className="font-bold">{remaining} {unit}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button>
          <button onClick={handleSubmit} disabled={loading || qty <= 0 || price <= 0}
            className="btn flex-1 bg-[var(--warning)] text-white hover:opacity-90">
            {loading ? "Đang xử lý..." : isPartial ? `Bán ${qty} ${unit}` : "Bán tất cả"}
          </button>
        </div>
      </div>
    </div>
  );
}
