"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  UserCircle, List, Users, Plus, Trash2, Shield, Send, AlertTriangle, X, Pencil,
  Key, Download, Upload, FileText, Clock, Tag, CheckCircle, RefreshCw, ExternalLink, Bell,
  Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "users", label: "Thành viên", icon: Users, adminOnly: true },
    { id: "categories", label: "Hạng mục & Từ khoá", icon: List, adminOnly: true },
    { id: "login", label: "Đăng nhập", icon: Key, adminOnly: true },
    { id: "market", label: "Giá thị trường", icon: RefreshCw, adminOnly: true },
    { id: "profile", label: "Tài khoản", icon: UserCircle },
    { id: "telegram", label: "Telegram", icon: Send },
  ];
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "profile");
    }
  }, [activeTab, visibleTabs]);

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Cài Đặt</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {isAdmin
            ? "Quản lý thành viên gia đình, hạng mục và cấu hình hệ thống"
            : "Cập nhật tài khoản cá nhân và kết nối Telegram"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors font-medium ${
                activeTab === tab.id
                  ? "bg-[var(--accent-muted)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-3">
          {activeTab === "users" && <UsersPanel />}
          {activeTab === "categories" && <CategoriesPanel />}
          {activeTab === "login" && <LoginConfigPanel />}
          {activeTab === "market" && <MarketDataPanel />}
          {activeTab === "profile" && <ProfilePanel />}
          {activeTab === "telegram" && <TelegramPanel />}
        </div>
      </div>
    </div>
  );
}

/* ═══════ USERS PANEL ═══════ */
function UsersPanel() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const currentUserId = (session?.user as any)?.id;

  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", username: "", phone: "", password: "", confirmPassword: "", role: "USER" });
  const [showFormPass, setShowFormPass] = useState(false);
  const [showFormConfirm, setShowFormConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [pendingPairs, setPendingPairs] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); });
    fetch("/api/telegram/pair", { method: "PUT" }).then(r => r.json()).then(d => { if (Array.isArray(d)) setPendingPairs(d); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Vui lòng điền Tên, Email và Mật khẩu");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    const { confirmPassword, ...payload } = form;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers(prev => [...prev, data]);
      setForm({ name: "", email: "", username: "", phone: "", password: "", confirmPassword: "", role: "USER" });
      setShowForm(false);
      toast.success("Đã thêm thành viên");
    } else {
      toast.error(data.error || "Thêm thất bại");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success("Đã xoá thành viên");
    } else {
      toast.error("Xoá thất bại");
    }
    setDeleteModal(null);
  };

  const handleResetPassword = async () => {
    if (!resetModal || !resetPw) { toast.error("Nhập mật khẩu mới"); return; }
    if (resetPw.length < 6) { toast.error("Tối thiểu 6 ký tự"); return; }
    setResetLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetModal.email, newPassword: resetPw }),
    });
    const data = await res.json();
    if (res.ok) { toast.success(`Đã đặt lại mật khẩu cho ${resetModal.name}`); setResetModal(null); setResetPw(""); setShowResetPw(false); }
    else toast.error(data.error || "Thất bại");
    setResetLoading(false);
  };

  const handlePairDecision = async (userId: string, approve: boolean) => {
    const res = await fetch("/api/telegram/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, approve }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(data.message);
      load();
    } else {
      toast.error(data.error || "Lỗi xử lý");
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Telegram pairing requests */}
      {pendingPairs.length > 0 && (
        <div className="card border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <Send size={16} className="text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">Yêu cầu kết nối Telegram ({pendingPairs.length})</span>
          </div>
          <div className="space-y-2">
            {pendingPairs.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-100">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{u.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{u.email} · Chat ID: {u.telegramChatId}</div>
                </div>
                <button onClick={() => handlePairDecision(u.id, false)} className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Từ chối</button>
                <button onClick={() => handlePairDecision(u.id, true)} className="px-3 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors">Duyệt</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-label mb-0">Thành viên gia đình</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-sm py-2 px-4">
            <Plus size={16} /> Thêm
          </button>
        </div>

        {showForm && (
          <div className="border border-[var(--border)] rounded-xl p-4 mb-6 bg-[var(--bg-input)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">Tên hiển thị *</label>
                <input className="input" placeholder="VD: Vợ Kian" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Email đăng nhập *</label>
                <input className="input" type="email" placeholder="vo@kiantr.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Tên đăng nhập (username)</label>
                <input className="input" placeholder="VD: vo_kian" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Số điện thoại</label>
                <input className="input" type="tel" placeholder="0912345678" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Mật khẩu *</label>
                <div className="relative">
                  <input className="input pr-10" type={showFormPass ? "text" : "password"} placeholder="Tối thiểu 6 ký tự" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                  <button type="button" onClick={() => setShowFormPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
                    {showFormPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Xác nhận mật khẩu *</label>
                <div className="relative">
                  <input className="input pr-10" type={showFormConfirm ? "text" : "password"} placeholder="Nhập lại mật khẩu" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} />
                  <button type="button" onClick={() => setShowFormConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
                    {showFormConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-[var(--danger)] mt-1">Mật khẩu không khớp</p>
                )}
              </div>
              <div>
                <label className="form-label">Vai trò</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="USER">Thành viên</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn btn-ghost text-sm py-2">Hủy</button>
              <button onClick={handleCreate} disabled={loading} className="btn btn-primary text-sm py-2">
                {loading ? "Đang tạo..." : "Tạo thành viên"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có thành viên nào</p>
          ) : users.map(user => (
            <div key={user.id} className="flex items-center gap-4 p-3 border border-[var(--border)] rounded-xl hover:border-[var(--accent)] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{user.name}</span>
                  {user.role === "ADMIN" && (
                    <span className="badge badge-info text-[10px] px-2 py-0.5"><Shield size={10} /> Admin</span>
                  )}
                  {user.telegramPaired && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200 flex items-center gap-1">
                      <Send size={9} /> Telegram
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {user.email}
                  {user.username && <span className="ml-2 opacity-60">@{user.username}</span>}
                  {user.phone && <span className="ml-2 opacity-60">{user.phone}</span>}
                </div>
              </div>
              {isAdmin && user.id !== currentUserId && (
                <button
                  onClick={() => { setResetModal({ id: user.id, name: user.name, email: user.email }); setResetPw(""); }}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-muted)] rounded-lg transition-colors"
                  title="Đặt lại mật khẩu"
                >
                  <Key size={16} />
                </button>
              )}
              {user.id !== currentUserId && (
                <button
                  onClick={() => setDeleteModal(user.id)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="card w-full max-w-sm animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2">Xác nhận xoá</h3>
              <p className="text-[var(--text-muted)] text-sm mb-6">Bạn có chắc muốn xoá thành viên này? Hành động không thể hoàn tác.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal(null)} className="btn btn-ghost flex-1">Hủy</button>
                <button onClick={() => handleDelete(deleteModal)} className="btn btn-danger flex-1">Xoá</button>
              </div>
            </div>
          </div>
        )}

        {resetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="card w-full max-w-sm animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-1">Đặt lại mật khẩu</h3>
              <p className="text-[var(--text-muted)] text-sm mb-4">Cho tài khoản <strong>{resetModal.name}</strong></p>
              <div className="form-group mb-4">
                <label className="form-label">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                <div className="relative">
                  <input
                    type={showResetPw ? "text" : "password"}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                  />
                  <button type="button" onClick={() => setShowResetPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
                    {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResetModal(null)} className="btn btn-ghost flex-1">Hủy</button>
                <button onClick={handleResetPassword} disabled={resetLoading || !resetPw} className="btn btn-primary flex-1">
                  {resetLoading ? "Đang lưu..." : "Đặt lại"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ CATEGORIES PANEL — bao gồm hạng mục, từ khoá, và alias tài khoản ═══════ */
function CategoriesPanel() {
  const [categories, setCategories] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", type: "EXPENSE" });
  const [catLoading, setCatLoading] = useState(false);
  const [deleteCat, setDeleteCat] = useState<any>(null);

  // Keyword form
  const [kwForm, setKwForm] = useState({ keyword: "", categoryId: "" });
  const [kwLoading, setKwLoading] = useState(false);
  const [editKw, setEditKw] = useState<any>(null);
  const [editKwVal, setEditKwVal] = useState({ keyword: "", categoryId: "" });

  // Alias modal
  const [aliasModal, setAliasModal] = useState<any>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState<string[]>([]);

  const load = useCallback(() => {
    fetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d); });
    fetch("/api/categories/keywords").then(r => r.json()).then(d => { if (Array.isArray(d)) setKeywords(d); });
    fetch("/api/accounts").then(r => r.json()).then(d => { if (Array.isArray(d)) setAccounts(d); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateCat = async () => {
    if (!catForm.name) { toast.error("Vui lòng nhập tên hạng mục"); return; }
    setCatLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories(prev => [...prev, cat]);
      setCatForm({ name: "", type: "EXPENSE" });
      setShowCatForm(false);
      toast.success("Đã thêm hạng mục");
    } else toast.error("Thêm thất bại");
    setCatLoading(false);
  };

  const handleDeleteCat = async () => {
    if (!deleteCat) return;
    const res = await fetch(`/api/categories?id=${deleteCat.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== deleteCat.id));
      setKeywords(prev => prev.filter(k => k.categoryId !== deleteCat.id));
      toast.success("Đã xoá hạng mục");
    } else {
      const data = await res.json();
      toast.error(data.error || "Xoá thất bại");
    }
    setDeleteCat(null);
  };

  const handleAddKeyword = async () => {
    if (!kwForm.keyword.trim() || !kwForm.categoryId) { toast.error("Vui lòng nhập từ khoá và chọn hạng mục"); return; }
    setKwLoading(true);
    const res = await fetch("/api/categories/keywords", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kwForm),
    });
    const data = await res.json();
    if (res.ok) {
      setKeywords(prev => [...prev, data]);
      setKwForm({ keyword: "", categoryId: "" });
      toast.success("Đã thêm từ khoá");
    } else toast.error(data.error || "Thêm thất bại");
    setKwLoading(false);
  };

  const handleDeleteKeyword = async (id: string) => {
    const res = await fetch(`/api/categories/keywords?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeywords(prev => prev.filter(k => k.id !== id));
      toast.success("Đã xoá từ khoá");
    }
  };

  const handleSaveEditKeyword = async () => {
    if (!editKw) return;
    const res = await fetch("/api/categories/keywords", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editKw.id, ...editKwVal }),
    });
    const data = await res.json();
    if (res.ok) {
      setKeywords(prev => prev.map(k => k.id === editKw.id ? data : k));
      setEditKw(null);
      toast.success("Đã cập nhật từ khoá");
    } else toast.error(data.error || "Cập nhật thất bại");
  };

  const openAliasModal = (acc: any) => {
    setAliasModal(acc);
    setAliasInput(acc.aliases || "");
    setAliasError([]);
  };

  const handleSaveAliases = async () => {
    if (!aliasModal) return;
    setAliasSaving(true);
    setAliasError([]);
    const newAliases = [...new Set(
      aliasInput.split(/[,\s]+/).filter(Boolean).map((s: string) => s.toLowerCase().trim())
    )];
    const conflicts: string[] = [];
    for (const alias of newAliases) {
      const owner = accounts.find(a =>
        a.id !== aliasModal.id && a.aliases &&
        a.aliases.split(/[,\s]+/).filter(Boolean).map((s: string) => s.toLowerCase().trim()).includes(alias)
      );
      if (owner) conflicts.push(`"${alias}" đã dùng bởi ${owner.name}`);
    }
    if (conflicts.length > 0) { setAliasError(conflicts); setAliasSaving(false); return; }
    const cleaned = newAliases.join(", ");
    const res = await fetch("/api/accounts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: aliasModal.id, aliases: cleaned }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAccounts(prev => prev.map(a => a.id === updated.id ? { ...a, aliases: updated.aliases } : a));
      toast.success("Đã lưu từ viết tắt");
      setAliasModal(null);
    } else toast.error("Lưu thất bại");
    setAliasSaving(false);
  };

  const expenses = categories.filter(c => c.type === "EXPENSE");
  const incomes = categories.filter(c => c.type === "INCOME");

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-label mb-0">Hạng mục thu chi</h3>
          <button onClick={() => setShowCatForm(!showCatForm)} className="btn btn-primary text-sm py-2 px-4">
            <Plus size={16} /> Thêm
          </button>
        </div>

        {showCatForm && (
          <div className="border border-[var(--border)] rounded-xl p-4 mb-6 bg-[var(--bg-input)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">Tên hạng mục</label>
                <input className="input" placeholder="VD: Bảo hiểm" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Loại</label>
                <select className="input" value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})}>
                  <option value="EXPENSE">Chi tiêu</option>
                  <option value="INCOME">Thu nhập</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCatForm(false)} className="btn btn-ghost text-sm py-2">Hủy</button>
              <button onClick={handleCreateCat} disabled={catLoading} className="btn btn-primary text-sm py-2">
                {catLoading ? "Đang tạo..." : "Tạo hạng mục"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="text-sm font-semibold text-[var(--danger)] mb-3 uppercase tracking-wider">Chi tiêu</div>
          <div className="flex flex-wrap gap-2">
            {expenses.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Chưa có hạng mục chi tiêu</p>
              : expenses.map(c => (
                <span key={c.id} className="badge border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 group inline-flex items-center gap-1.5">
                  {c.name}
                  <button onClick={() => setDeleteCat(c)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] hover:scale-125 transition-all" title="Xoá">×</button>
                </span>
              ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-[var(--success)] mb-3 uppercase tracking-wider">Thu nhập</div>
          <div className="flex flex-wrap gap-2">
            {incomes.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Chưa có hạng mục thu nhập</p>
              : incomes.map(c => (
                <span key={c.id} className="badge border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 group inline-flex items-center gap-1.5">
                  {c.name}
                  <button onClick={() => setDeleteCat(c)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] hover:scale-125 transition-all" title="Xoá">×</button>
                </span>
              ))}
          </div>
        </div>

        {deleteCat && (
          <div className="modal-overlay" onClick={() => setDeleteCat(null)}>
            <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0"><AlertTriangle size={20} /></div>
                <div>
                  <h3 className="font-bold">Xoá hạng mục?</h3>
                  <p className="text-sm text-[var(--text-muted)]">Xoá &quot;{deleteCat.name}&quot; không thể hoàn tác.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteCat(null)} className="btn btn-ghost flex-1">Hủy</button>
                <button onClick={handleDeleteCat} className="btn flex-1 bg-[var(--danger)] text-white hover:opacity-90">Xoá</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Keywords */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Tag size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Từ khoá tự động chọn hạng mục</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Khi nhập chi tiêu qua Telegram, bot sẽ tự động chọn hạng mục nếu ghi chú chứa từ khoá.
          VD: &quot;bánh mì&quot; → Ăn uống, &quot;xăng&quot; → Đi lại.
        </p>

        {/* Add keyword form */}
        <div className="p-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-input)] mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Từ khoá</label>
              <input
                className="input"
                placeholder="VD: bánh mì, nhậu, xăng..."
                value={kwForm.keyword}
                onChange={e => setKwForm({...kwForm, keyword: e.target.value})}
                onKeyDown={e => e.key === "Enter" && handleAddKeyword()}
              />
            </div>
            <div>
              <label className="form-label">Hạng mục tương ứng</label>
              <select
                className="input"
                value={kwForm.categoryId}
                onChange={e => setKwForm({...kwForm, categoryId: e.target.value})}
              >
                <option value="">— Chọn hạng mục —</option>
                <optgroup label="Chi tiêu">
                  {expenses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Thu nhập">
                  {incomes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAddKeyword} disabled={kwLoading || !kwForm.keyword.trim() || !kwForm.categoryId} className="btn btn-primary text-sm py-2 px-5">
              <Plus size={15} /> Thêm từ khoá
            </button>
          </div>
        </div>

        {keywords.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">Chưa có từ khoá nào. Thêm từ khoá để bot tự nhận diện hạng mục.</p>
        ) : (
          <div className="space-y-2">
            {keywords.map(kw => (
              <div key={kw.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition-colors group">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] font-semibold font-mono">{kw.keyword}</span>
                <span className="text-[var(--text-muted)] text-xs">→</span>
                <span className="text-sm font-medium flex-1">{kw.category?.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${kw.category?.type === "EXPENSE" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                  {kw.category?.type === "EXPENSE" ? "Chi" : "Thu"}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditKw(kw); setEditKwVal({ keyword: kw.keyword, categoryId: kw.categoryId }); }} className="p-1 rounded hover:bg-[var(--accent-muted)] text-[var(--text-muted)] hover:text-[var(--accent)]"><Pencil size={13} /></button>
                  <button onClick={() => handleDeleteKeyword(kw.id)} className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Aliases */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Key size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Từ viết tắt tài khoản</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Nhắn <code className="px-1 py-0.5 bg-[var(--bg-input)] rounded">chi 20k cafe vcb</code> → bot tự chọn đúng tài khoản Vietcombank.
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Chưa có tài khoản nào.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{acc.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {acc.aliases ? (
                      acc.aliases.split(/[,\s]+/).filter(Boolean).map((alias: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] font-semibold">{alias}</span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] italic">Chưa có từ viết tắt</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openAliasModal(acc)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[var(--accent-muted)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all"
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Keyword Modal */}
      {editKw && (
        <div className="modal-overlay" onClick={() => setEditKw(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Sửa từ khoá</h3>
              <button onClick={() => setEditKw(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="form-label">Từ khoá</label>
                <input className="input" value={editKwVal.keyword} onChange={e => setEditKwVal({...editKwVal, keyword: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Hạng mục</label>
                <select className="input" value={editKwVal.categoryId} onChange={e => setEditKwVal({...editKwVal, categoryId: e.target.value})}>
                  <optgroup label="Chi tiêu">{expenses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  <optgroup label="Thu nhập">{incomes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditKw(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleSaveEditKeyword} className="btn btn-primary flex-1">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Alias Edit Modal */}
      {aliasModal && (
        <div className="modal-overlay" onClick={() => setAliasModal(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Từ viết tắt</h3>
                <p className="text-sm text-[var(--text-muted)]">{aliasModal.name}</p>
              </div>
              <button onClick={() => setAliasModal(null)} className="text-[var(--text-muted)]"><X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Từ viết tắt (phân cách bằng dấu phẩy hoặc dấu cách)</label>
              <input
                className={`input ${aliasError.length > 0 ? "border-[var(--danger)]" : ""}`}
                placeholder="VD: vcb, viet, vietcom"
                value={aliasInput}
                onChange={e => { setAliasInput(e.target.value); setAliasError([]); }}
                autoFocus
              />
            </div>
            {aliasInput.trim() && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-[var(--bg-input)]">
                {[...new Set(aliasInput.split(/[,\s]+/).filter(Boolean).map((a: string) => a.toLowerCase().trim()))].map((a, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] font-semibold">{a}</span>
                ))}
              </div>
            )}
            {aliasError.length > 0 && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">{aliasError.map((e, i) => <div key={i}>{e}</div>)}</div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setAliasModal(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleSaveAliases} disabled={aliasSaving} className="btn btn-primary flex-1">
                {aliasSaving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ PROFILE PANEL ═══════ */
function ProfilePanel() {
  const { data: session } = useSession();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pairInfo, setPairInfo] = useState<any>(null);
  const [pairLoading, setPairLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/users/${session.user.id}`).then(r => r.json()).then(d => {
      if (d?.id) { setUser(d); setName(d.name || ""); setUsername(d.username || ""); setPhone(d.phone || ""); }
    });
    fetch("/api/telegram/pair").then(r => r.json()).then(d => setPairInfo(d));
  }, [session?.user?.id]);

  // P5: Auto-poll khi đang chờ admin duyệt pair
  useEffect(() => {
    if (!pairInfo || pairInfo.paired) return;
    const interval = setInterval(() => {
      fetch("/api/telegram/pair").then(r => r.json()).then(d => {
        setPairInfo(d);
        if (d.paired) {
          toast.success("Đã kết nối Telegram thành công!");
        }
      }).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [pairInfo?.paired]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username: username || null, phone: phone || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      toast.success("Đã cập nhật thông tin");
    } else {
      const d = await res.json();
      toast.error(d.error || "Cập nhật thất bại");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!user || !newPassword) { toast.error("Nhập mật khẩu mới"); return; }
    if (!currentPassword) { toast.error("Nhập mật khẩu hiện tại"); return; }
    if (newPassword.length < 6) { toast.error("Mật khẩu tối thiểu 6 ký tự"); return; }
    setSavingPw(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword, oldPassword: currentPassword }),
    });
    const d = await res.json();
    if (res.ok) { setNewPassword(""); setCurrentPassword(""); toast.success("Đã đổi mật khẩu"); }
    else toast.error(d.error || "Đổi mật khẩu thất bại");
    setSavingPw(false);
  };

  const handleRegenerateCode = async () => {
    setPairLoading(true);
    // Force regenerate by temporarily clearing it
    await fetch(`/api/users/${user?.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramPairingCode: null }),
    });
    const r = await fetch("/api/telegram/pair");
    const d = await r.json();
    setPairInfo(d);
    setPairLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="section-label mb-6">Thông tin cá nhân</h3>
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Tên hiển thị</label>
            <input type="text" className="input max-w-md" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tên đăng nhập (username)</label>
            <input type="text" className="input max-w-md" placeholder="VD: kian_fire" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <input type="tel" className="input max-w-md" placeholder="0912345678" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email đăng nhập</label>
            <input type="email" className="input max-w-md opacity-60" value={user?.email || ""} disabled />
          </div>
          <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary text-sm py-2 px-6">
            {saving ? "Lưu..." : "Lưu thông tin"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="section-label mb-4">Đổi mật khẩu</h3>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="form-label">Mật khẩu hiện tại</label>
            <input type="password" className="input" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Mật khẩu mới (tối thiểu 6 ký tự)</label>
            <input type="password" className="input" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <button onClick={handleChangePassword} disabled={savingPw || !newPassword || !currentPassword} className="btn btn-primary text-sm py-2 px-6">
            {savingPw ? "Đang lưu..." : "Đổi mật khẩu"}
          </button>
        </div>
      </div>

      {/* Telegram pairing */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Send size={16} className="text-blue-500" />
          <h3 className="section-label mb-0">Kết nối Telegram cá nhân</h3>
        </div>
        {pairInfo?.paired ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
            <CheckCircle size={20} className="text-green-500" />
            <div>
              <div className="font-semibold text-sm text-green-700">Đã kết nối Telegram</div>
              <div className="text-xs text-green-600">Chat ID: {user?.telegramChatId}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              Kết nối tài khoản của bạn với bot Telegram để nhận báo cáo cá nhân và nhập chi tiêu.
            </p>
            {pairInfo?.code && (
              <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">Mã kết nối của bạn:</div>
                <div className="flex items-center gap-3">
                  <code className="text-2xl font-bold tracking-widest text-[var(--accent)]">{pairInfo.code}</code>
                  <button onClick={handleRegenerateCode} disabled={pairLoading} className="p-2 rounded-lg hover:bg-[var(--accent-muted)] text-[var(--text-muted)] hover:text-[var(--accent)]" title="Tạo mã mới">
                    <RefreshCw size={14} className={pairLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  {pairInfo.botUsername ? (
                    <a
                      href={`https://t.me/${pairInfo.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink size={15} /> Mở @{pairInfo.botUsername} trong Telegram
                    </a>
                  ) : null}
                  <div className="text-xs text-[var(--text-muted)] space-y-1 pt-1">
                    <div>1. Mở bot Telegram ở trên</div>
                    <div>2. Gõ: <code className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded font-mono">/pair {pairInfo.code}</code></div>
                    <div>3. Chờ Admin duyệt — trang này tự cập nhật khi được duyệt</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ LOGIN CONFIG PANEL ═══════ */
function LoginConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [info, setInfo] = useState({
    enabled: false,
    source: "NONE",
    clientIdMasked: "",
    projectId: "",
    updatedAt: "",
    callbackUrl: "",
  });
  const [lastRedirectUris, setLastRedirectUris] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/google-auth");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setInfo({
        enabled: !!data.enabled,
        source: data.source || "NONE",
        clientIdMasked: data.clientIdMasked || "",
        projectId: data.projectId || "",
        updatedAt: data.updatedAt || "",
        callbackUrl: data.callbackUrl || "",
      });
    } else {
      toast.error(data.error || "Không tải được cấu hình Google login");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Chỉ nhận file .json");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/google-auth", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Đã lưu cấu hình Google từ file JSON");
      setFileName(file.name);
      setLastRedirectUris(Array.isArray(data.redirectUris) ? data.redirectUris : []);
      await load();
    } else {
      toast.error(data.error || "Upload thất bại");
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    const res = await fetch("/api/settings/google-auth", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Đã tắt Google login từ cấu hình JSON");
      setFileName("");
      setLastRedirectUris([]);
      await load();
    } else {
      toast.error(data.error || "Không thể xoá cấu hình");
    }
    setRemoving(false);
  };

  if (loading) return <div className="card p-8"><div className="skeleton h-40 w-full"></div></div>;

  const updatedLabel = info.updatedAt
    ? new Date(info.updatedAt).toLocaleString("vi-VN")
    : "Chưa có";

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Key size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Đăng nhập Google (Upload JSON)</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          Upload trực tiếp file JSON OAuth client từ Google Cloud. Hệ thống tự lấy client id/secret, không cần nhập tay.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
            <div className="text-xs text-[var(--text-muted)]">Trạng thái</div>
            <div className={`text-sm font-semibold mt-1 ${info.enabled ? "text-green-600" : "text-[var(--text-secondary)]"}`}>
              {info.enabled ? "Đã bật Google login" : "Chưa bật Google login"}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
            <div className="text-xs text-[var(--text-muted)]">Nguồn cấu hình</div>
            <div className="text-sm font-semibold mt-1">{info.source}</div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
            <div className="text-xs text-[var(--text-muted)]">Client ID</div>
            <div className="text-sm font-semibold mt-1">{info.clientIdMasked || "Chưa có"}</div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
            <div className="text-xs text-[var(--text-muted)]">Project</div>
            <div className="text-sm font-semibold mt-1">{info.projectId || "Chưa có"}</div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] md:col-span-2">
            <div className="text-xs text-[var(--text-muted)]">Callback URL cần có trong Google Console</div>
            <div className="text-sm font-semibold mt-1 break-all">{info.callbackUrl || "Chưa xác định"}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] mb-4">
          <label className="form-label">Upload file OAuth JSON</label>
          <input
            type="file"
            accept=".json,application/json"
            className="input"
            onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            disabled={uploading}
          />
          <div className="text-xs text-[var(--text-muted)] mt-2">
            {fileName ? `File gần nhất: ${fileName}` : "Chưa upload file nào trong phiên này."}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Cập nhật gần nhất: {updatedLabel}</div>
        </div>

        {lastRedirectUris.length > 0 && (
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] mb-4">
            <div className="text-xs text-[var(--text-muted)] mb-1">Redirect URI trong file JSON vừa upload</div>
            <div className="text-sm space-y-1">
              {lastRedirectUris.map((uri) => (
                <div key={uri} className="break-all">{uri}</div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={load}
            className="btn btn-ghost border border-[var(--border)] flex-1"
            disabled={loading || uploading}
          >
            {loading ? "Đang tải..." : "Tải lại trạng thái"}
          </button>
          <button
            onClick={handleRemove}
            className="btn btn-danger flex-1"
            disabled={removing}
          >
            {removing ? "Đang tắt..." : "Tắt Google login"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════ MARKET DATA PANEL ═══════ */
function MarketDataPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState({
    apiKey: "",
    autoUpdate: false,
    intervalMin: 720,
    goldPrimarySymbol: "XAU/USD",
    goldFxSymbol: "USD/VND",
    goldPremiumPct: 0,
  });
  const [apiKeyMasked, setApiKeyMasked] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/settings/market-data")
      .then(r => r.json())
      .then(data => {
        setApiKeyMasked(data.apiKeyMasked || "");
        setForm({
          apiKey: "",
          autoUpdate: !!data.autoUpdate,
          intervalMin: Number(data.intervalMin || 720),
          goldPrimarySymbol: data.goldPrimarySymbol || "XAU/USD",
          goldFxSymbol: data.goldFxSymbol || "USD/VND",
          goldPremiumPct: Number(data.goldPremiumPct || 0),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      autoUpdate: form.autoUpdate,
      intervalMin: form.intervalMin,
      goldPrimarySymbol: form.goldPrimarySymbol,
      goldFxSymbol: form.goldFxSymbol,
      goldPremiumPct: Number(form.goldPremiumPct) || 0,
    };
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

    const res = await fetch("/api/settings/market-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Đã lưu cài đặt dữ liệu giá");
      load();
      setForm(prev => ({ ...prev, apiKey: "" }));
    } else {
      const data = await res.json();
      toast.error(data.error || "Lưu thất bại");
    }
    setSaving(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    const res = await fetch("/api/settings/market-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-now" }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Đồng bộ: ${data.updated || 0} thành công, ${data.failed || 0} lỗi`);
    } else {
      toast.error(data.error || "Không đồng bộ được");
    }
    setSyncing(false);
  };

  if (loading) return <div className="card p-8"><div className="skeleton h-36 w-full"></div></div>;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Nguồn giá tự động</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          Cổ phiếu Việt Nam lấy từ Vnstock (KBS). Vàng và mã quốc tế dùng TwelveData nếu có API key.
        </p>

        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Provider</label>
            <input className="input" value="Vnstock (KBS) + TwelveData" readOnly />
          </div>

          <div className="form-group">
            <label className="form-label">TwelveData API Key (tuỳ chọn)</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                className="input pr-10"
                placeholder={apiKeyMasked ? `Đang dùng: ${apiKeyMasked}` : "Nhập API key TwelveData"}
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
              />
              <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Không bắt buộc cho cổ phiếu VN. Chỉ cần khi muốn lấy vàng (XAU/USD, USD/VND) hoặc mã quốc tế.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
              <input type="checkbox" checked={form.autoUpdate} onChange={e => setForm({ ...form, autoUpdate: e.target.checked })} className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
              <div>
                <div className="text-sm font-semibold">Tự động cập nhật giá</div>
                <div className="text-xs text-[var(--text-muted)]">Scheduler sẽ tự refresh</div>
              </div>
            </label>
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
              <label className="text-xs text-[var(--text-muted)]">Chu kỳ (phút)</label>
              <input
                type="number"
                min="1"
                max="1440"
                className="input mt-1"
                value={form.intervalMin}
                onChange={e => setForm({ ...form, intervalMin: Number(e.target.value) || 720 })}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Gợi ý: 720 phút (2 lần/ngày).</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="form-label">Symbol vàng</label>
              <input className="input" value={form.goldPrimarySymbol} onChange={e => setForm({ ...form, goldPrimarySymbol: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Symbol USD/VND</label>
              <input className="input" value={form.goldFxSymbol} onChange={e => setForm({ ...form, goldFxSymbol: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Premium vàng nội địa (%)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.goldPremiumPct}
                onChange={e => setForm({ ...form, goldPremiumPct: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
            <button onClick={syncNow} disabled={syncing} className="btn btn-ghost border border-[var(--border)] flex-1">
              {syncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════ TELEGRAM PANEL ═══════ */
function TelegramPanel() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username: string; name: string } | null>(null);
  const [tokenMasked, setTokenMasked] = useState("");
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [schedule, setSchedule] = useState<any>({
    reminderTime: "",
    dailyReportTime: "", weeklyReportDay: "", weeklyReportTime: "",
    monthlyReportDay: "", monthlyReportTime: "",
    quarterlyReport: false, yearlyReport: false, cronSecret: "",
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/settings/telegram")
      .then(r => r.json())
      .then(data => {
        setConnected(data.connected);
        setBotInfo(data.botInfo);
        setTokenMasked(data.tokenMasked || "");
        if (data.schedule) setSchedule({ ...data.schedule, reminderTime: data.schedule.reminderTime || "" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    if (!token.trim()) { toast.error("Vui lòng nhập Bot Token"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setConnected(true); setBotInfo(data.botInfo);
        setTokenMasked(`${token.slice(0, 8)}...${token.slice(-4)}`);
        setToken("");
      } else toast.error(data.error);
    } catch { toast.error("Lỗi kết nối server"); }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/telegram", { method: "DELETE" });
      const data = await res.json();
      if (data.success) { toast.success(data.message); setConnected(false); setBotInfo(null); setTokenMasked(""); }
    } catch { toast.error("Lỗi ngắt kết nối"); }
    setSaving(false); setDisconnectConfirm(false);
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    const res = await fetch("/api/settings/telegram", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    if (res.ok) {
      const data = await res.json();
      setSchedule((prev: any) => ({ ...prev, cronSecret: data.cronSecret || prev.cronSecret }));
      toast.success("Đã lưu — lịch báo cáo sẽ tự động chạy");
    } else {
      toast.error("Lưu thất bại");
    }
    setScheduleSaving(false);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Đã import ${data.imported} giao dịch${data.skipped > 0 ? `, bỏ qua ${data.skipped} dòng lỗi` : ""}`);
      setImportFile(null);
    } else {
      toast.error(data.error || "Import thất bại");
    }
    setImporting(false);
  };

  if (loading) return <div className="card p-8"><div className="skeleton h-40 w-full"></div></div>;

  const weekDays = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

  return (
    <div className="space-y-6">
      {/* Bot connection */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="section-label mb-0">Telegram Bot</div>
          {connected && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">Đã kết nối</span>}
        </div>

        {connected && botInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-input)]">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Send size={22} /></div>
              <div>
                <div className="font-semibold">@{botInfo.username}</div>
                <div className="text-sm text-[var(--text-muted)]">{botInfo.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Token: {tokenMasked}</div>
              </div>
            </div>
            <button onClick={() => setDisconnectConfirm(true)} disabled={saving} className="w-full py-2 rounded-xl border border-[var(--danger)] text-[var(--danger)] hover:bg-red-50 transition-colors text-sm font-medium">
              Ngắt kết nối
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Kết nối Telegram bot để nhập thu chi nhanh qua chat.</p>
            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">Hướng dẫn lấy Token</h4>
              <ol className="text-sm space-y-2 text-[var(--text-secondary)]">
                <li>1. Mở Telegram → tìm <b>@BotFather</b></li>
                <li>2. Gõ <code className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">/newbot</code></li>
                <li>3. Đặt tên bot (VD: Kian FIRE)</li>
                <li>4. Copy token BotFather gửi → dán vào ô dưới</li>
              </ol>
            </div>
            <div>
              <label className="form-label">Bot Token</label>
              <input type="text" className="input" placeholder="7123456789:AAHxyz..." value={token} onChange={e => setToken(e.target.value)} />
            </div>
            <button onClick={handleConnect} disabled={saving || !token.trim()} className="btn btn-primary w-full">
              {saving ? "Đang kết nối..." : "Kết nối Bot"}
            </button>
          </div>
        )}
      </div>

      {/* Scheduled Reports */}
      {connected && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-[var(--accent)]" />
            <h3 className="section-label mb-0">Lịch tự động qua Telegram</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-5">
            App tự chạy theo lịch, không cần setup thêm gì trên VPS.
          </p>

          <div className="space-y-3">
            {/* Reminder */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-muted)]">
              <div className="flex-1">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Bell size={14} className="text-[var(--accent)]" /> Nhắc nhập thu chi hàng ngày
                </div>
                <div className="text-xs text-[var(--text-muted)]">Chỉ nhắc nếu chưa nhập hôm nay — không spam</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Lúc</span>
                <input type="time" className="input w-28 text-sm" value={schedule.reminderTime} onChange={e => setSchedule({...schedule, reminderTime: e.target.value})} />
              </div>
            </div>

            {/* Daily */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
              <div className="flex-1">
                <div className="text-sm font-semibold">📅 Báo cáo ngày</div>
                <div className="text-xs text-[var(--text-muted)]">Chi tiêu hôm nay vs hôm qua</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Gửi lúc</span>
                <input type="time" className="input w-28 text-sm" value={schedule.dailyReportTime} onChange={e => setSchedule({...schedule, dailyReportTime: e.target.value})} />
              </div>
            </div>

            {/* Weekly */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
              <div className="flex-1">
                <div className="text-sm font-semibold">📆 Báo cáo tuần</div>
                <div className="text-xs text-[var(--text-muted)]">Tuần này vs tuần trước</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Vào</span>
                <select className="input w-28 text-sm" value={schedule.weeklyReportDay ?? ""} onChange={e => setSchedule({...schedule, weeklyReportDay: e.target.value})}>
                  <option value="">— Ngày —</option>
                  {weekDays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input type="time" className="input w-28 text-sm" value={schedule.weeklyReportTime} onChange={e => setSchedule({...schedule, weeklyReportTime: e.target.value})} />
              </div>
            </div>

            {/* Monthly */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]">
              <div className="flex-1">
                <div className="text-sm font-semibold">🗓 Báo cáo tháng</div>
                <div className="text-xs text-[var(--text-muted)]">Tháng này vs tháng trước</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Ngày</span>
                <input type="number" min="1" max="31" className="input w-16 text-sm text-center" placeholder="28" value={schedule.monthlyReportDay ?? ""} onChange={e => setSchedule({...schedule, monthlyReportDay: e.target.value})} />
                <input type="time" className="input w-28 text-sm" value={schedule.monthlyReportTime} onChange={e => setSchedule({...schedule, monthlyReportTime: e.target.value})} />
              </div>
            </div>

            {/* Quarterly & Yearly */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] hover:border-[var(--accent)] transition-colors">
                <input type="checkbox" checked={schedule.quarterlyReport} onChange={e => setSchedule({...schedule, quarterlyReport: e.target.checked})} className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
                <div>
                  <div className="text-sm font-semibold">📊 Báo cáo quý</div>
                  <div className="text-xs text-[var(--text-muted)]">Cuối mỗi quý</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] hover:border-[var(--accent)] transition-colors">
                <input type="checkbox" checked={schedule.yearlyReport} onChange={e => setSchedule({...schedule, yearlyReport: e.target.checked})} className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
                <div>
                  <div className="text-sm font-semibold">🏆 Báo cáo năm</div>
                  <div className="text-xs text-[var(--text-muted)]">31/12 hàng năm</div>
                </div>
              </label>
            </div>

            <button onClick={handleSaveSchedule} disabled={scheduleSaving} className="btn btn-primary w-full">
              {scheduleSaving ? "Đang lưu..." : "Lưu lịch tự động"}
            </button>
          </div>
        </div>
      )}

      {/* Excel export/import */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-[var(--accent)]" />
          <h3 className="section-label mb-0">Export / Import dữ liệu</h3>
        </div>

        <div className="space-y-4">
          {/* Export */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <Download size={18} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Xuất dữ liệu Excel</div>
              <div className="text-xs text-[var(--text-muted)]">Tải toàn bộ giao dịch ra file .xlsx</div>
            </div>
            <a href="/api/transactions/export" download className="btn btn-primary text-sm py-2 px-4">
              <Download size={14} /> Xuất Excel
            </a>
          </div>

          {/* Template */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">File mẫu Import</div>
              <div className="text-xs text-[var(--text-muted)]">Tải file mẫu với hướng dẫn định dạng</div>
            </div>
            <a href="/api/transactions/template" download className="btn btn-ghost border border-[var(--border)] text-sm py-2 px-4">
              <Download size={14} /> Tải mẫu
            </a>
          </div>

          {/* Import */}
          <div className="p-4 rounded-xl border border-[var(--border)] border-dashed">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={16} className="text-[var(--accent)]" />
              <span className="font-semibold text-sm">Import từ Excel</span>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="input mb-3 cursor-pointer"
              onChange={e => setImportFile(e.target.files?.[0] || null)}
            />
            {importFile && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] flex-1">{importFile.name} ({(importFile.size / 1024).toFixed(0)} KB)</span>
                <button onClick={handleImport} disabled={importing} className="btn btn-primary text-sm py-2">
                  {importing ? "Đang import..." : "Import"}
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-2">Chỉ chấp nhận file .xlsx. Tải file mẫu để xem định dạng đúng.</p>
          </div>
        </div>
      </div>

      {connected && (
        <div className="card p-6">
          <div className="section-label">Cách sử dụng bot</div>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-[var(--bg-input)]">
              <div className="font-semibold text-[var(--danger)] mb-1">Nhập chi tiêu</div>
              <code className="text-xs">chi 50k cà phê</code> · <code className="text-xs">chi 1.5tr tiền nhà</code>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-input)]">
              <div className="font-semibold text-[var(--success)] mb-1">Nhập thu nhập</div>
              <code className="text-xs">thu 5tr lương</code> · <code className="text-xs">thu 500k freelance</code>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-input)]">
              <div className="font-semibold text-[var(--info)] mb-1">Lệnh</div>
              <code className="text-xs">/balance</code> — Số dư · <code className="text-xs">/today</code> — Hôm nay · <code className="text-xs">/help</code>
            </div>
          </div>
        </div>
      )}

      {disconnectConfirm && (
        <div className="modal-overlay" onClick={() => setDisconnectConfirm(false)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0"><AlertTriangle size={20} /></div>
              <div>
                <h3 className="font-bold">Ngắt kết nối Telegram?</h3>
                <p className="text-sm text-[var(--text-muted)]">Bot sẽ ngừng nhận lệnh từ bạn.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDisconnectConfirm(false)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={handleDisconnect} disabled={saving} className="btn flex-1 bg-[var(--danger)] text-white hover:opacity-90">
                {saving ? "Đang ngắt..." : "Ngắt kết nối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
