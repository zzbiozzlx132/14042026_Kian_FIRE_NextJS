"use client";

import { useState, useEffect } from "react";
import { Plus, Wallet, TrendingUp, ArrowDownRight, Diamond, Trash2 } from "lucide-react";
import { fmtMoney, fmtMoneyCompact, ACCOUNT_TYPE_LABELS, INVESTMENT_TYPE_LABELS, DEBT_TYPE_LABELS } from "@/lib/utils";
import { toast } from "sonner";

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then(r => r.json()),
    ]).then(([accs]) => {
      if (Array.isArray(accs)) setAccounts(accs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tài sản & Đầu tư</h1>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={18} /> Thêm mới
        </button>
      </div>

      <div className="tab-bar inline-flex mb-6">
        {[
          { id: "accounts", icon: Wallet, label: "Tài khoản/Ví" },
          { id: "investments", icon: TrendingUp, label: "Đầu tư" },
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

      {/* Accounts Tab */}
      {activeTab === "accounts" && (
        <div>
          {accounts.length === 0 ? (
            <EmptyState text="Chưa có tài khoản nào. Hệ thống sẽ tự tạo khi khởi động." />
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
                  <div className={`text-2xl font-bold ${acc.type === "CREDIT_CARD" && acc.initialBalance < 0 ? "text-[var(--danger)]" : ""}`}>
                    {fmtMoney(acc.initialBalance)}
                  </div>
                  {acc.creditLimit && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs">
                      <span className="text-[var(--text-muted)] font-semibold uppercase tracking-wider">Hạn mức</span>
                      <span className="font-semibold">{fmtMoneyCompact(acc.creditLimit)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Investments Tab */}
      {activeTab === "investments" && (
        <EmptyState text="Chức năng quản lý đầu tư đang được phát triển. Bạn có thể thêm khoản đầu tư từ API." />
      )}

      {/* Debts Tab */}
      {activeTab === "debts" && (
        <EmptyState text="Chức năng quản lý nợ đang được phát triển. Bạn có thể thêm khoản nợ từ API." />
      )}

      {/* Add Account Modal */}
      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} onCreated={(acc: any) => {
        setAccounts(prev => [...prev, acc]);
        setShowAddModal(false);
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

function AddAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (acc: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("BANK");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) { toast.error("Vui lòng nhập tên tài khoản"); return; }
    setLoading(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, initialBalance: parseFloat(balance) || 0 }),
    });
    if (res.ok) {
      const acc = await res.json();
      toast.success("Đã thêm tài khoản");
      onCreated(acc);
    } else {
      toast.error("Thêm thất bại");
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-6">Thêm tài khoản</h2>
        <div className="form-group">
          <label className="form-label">Tên tài khoản</label>
          <input className="input" placeholder="VD: Vietcombank" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Loại</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK">Ngân hàng</option>
            <option value="E_WALLET">Ví điện tử</option>
            <option value="CREDIT_CARD">Thẻ tín dụng</option>
            <option value="SAVINGS">Tiết kiệm</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Số dư ban đầu (VNĐ)</label>
          <input className="input" type="number" placeholder="0" value={balance} onChange={e => setBalance(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn btn-ghost flex-1">Hủy</button>
          <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">
            {loading ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}
