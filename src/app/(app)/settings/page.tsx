"use client";

import { useState, useEffect } from "react";
import { UserCircle, List, Users, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("users");

  const tabs = [
    { id: "users", label: "Thành viên", icon: Users },
    { id: "categories", label: "Hạng mục", icon: List },
    { id: "profile", label: "Tài khoản", icon: UserCircle },
  ];

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Cài Đặt</h1>
        <p className="text-sm text-[var(--text-muted)]">Quản lý thành viên gia đình, hạng mục và cấu hình hệ thống</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {tabs.map(tab => (
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
          {activeTab === "profile" && <ProfilePanel />}
        </div>
      </div>
    </div>
  );
}

/* ═══════ USERS PANEL ═══════ */
function UsersPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); });
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers(prev => [...prev, data]);
      setForm({ name: "", email: "", password: "", role: "USER" });
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

  return (
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
              <label className="form-label">Tên</label>
              <input className="input" placeholder="VD: Vợ Kian" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Email đăng nhập</label>
              <input className="input" type="email" placeholder="VD: vo@kiantr.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Mật khẩu</label>
              <input className="input" type="password" placeholder="Tối thiểu 6 ký tự" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
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
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{user.name}</span>
                {user.role === "ADMIN" && (
                  <span className="badge badge-info text-[10px] px-2 py-0.5">
                    <Shield size={10} /> Admin
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{user.email}</div>
            </div>
            <button 
              onClick={() => setDeleteModal(user.id)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Delete Modal - bg-black/40 backdrop-blur-sm */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="card w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Xác nhận xoá</h3>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              Bạn có chắc muốn xoá thành viên này? Hành động không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="btn btn-ghost flex-1">Hủy</button>
              <button onClick={() => handleDelete(deleteModal)} className="btn btn-danger flex-1">Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ CATEGORIES PANEL ═══════ */
function CategoriesPanel() {
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "EXPENSE" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d); });
  }, []);

  const handleCreate = async () => {
    if (!form.name) { toast.error("Vui lòng nhập tên hạng mục"); return; }
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories(prev => [...prev, cat]);
      setForm({ name: "", type: "EXPENSE" });
      setShowForm(false);
      toast.success("Đã thêm hạng mục");
    } else {
      toast.error("Thêm thất bại");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success("Đã xoá hạng mục");
    } else {
      const data = await res.json();
      toast.error(data.error || "Xoá thất bại");
    }
  };

  const expenses = categories.filter(c => c.type === "EXPENSE");
  const incomes = categories.filter(c => c.type === "INCOME");

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="section-label mb-0">Hạng mục thu chi</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-sm py-2 px-4">
          <Plus size={16} /> Thêm
        </button>
      </div>

      {showForm && (
        <div className="border border-[var(--border)] rounded-xl p-4 mb-6 bg-[var(--bg-input)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Tên hạng mục</label>
              <input className="input" placeholder="VD: Bảo hiểm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Loại</label>
              <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="EXPENSE">Chi tiêu</option>
                <option value="INCOME">Thu nhập</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn btn-ghost text-sm py-2">Hủy</button>
            <button onClick={handleCreate} disabled={loading} className="btn btn-primary text-sm py-2">
              {loading ? "Đang tạo..." : "Tạo hạng mục"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="text-sm font-semibold text-[var(--danger)] mb-3 uppercase tracking-wider">Chi tiêu</div>
        <div className="flex flex-wrap gap-2">
          {expenses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Chưa có hạng mục chi tiêu</p>
          ) : expenses.map(c => (
            <span key={c.id} className="badge border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 group inline-flex items-center gap-1.5">
              {c.name}
              <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] hover:scale-125 transition-all" title="Xoá">×</button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-[var(--success)] mb-3 uppercase tracking-wider">Thu nhập</div>
        <div className="flex flex-wrap gap-2">
          {incomes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Chưa có hạng mục thu nhập</p>
          ) : incomes.map(c => (
            <span key={c.id} className="badge border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 group inline-flex items-center gap-1.5">
              {c.name}
              <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] hover:scale-125 transition-all" title="Xoá">×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════ PROFILE PANEL ═══════ */
function ProfilePanel() {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        // Find from session or first admin
        const admin = d.find((u: any) => u.role === "ADMIN") || d[0];
        setUser(admin);
        setName(admin.name || "");
      }
    });
  }, []);

  const handleSaveName = async () => {
    if (!user || !name) return;
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      toast.success("Đã cập nhật tên");
    } else toast.error("Cập nhật thất bại");
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!user || !newPassword) { toast.error("Nhập mật khẩu mới"); return; }
    if (newPassword.length < 6) { toast.error("Mật khẩu tối thiểu 6 ký tự"); return; }
    setSavingPw(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) { setNewPassword(""); toast.success("Đã đổi mật khẩu"); }
    else toast.error("Đổi mật khẩu thất bại");
    setSavingPw(false);
  };

  return (
    <div className="card">
      <h3 className="section-label mb-6">Thông tin tài khoản</h3>
      <div className="space-y-6">
        <div className="form-group">
          <label className="form-label">Tên hiển thị</label>
          <div className="flex gap-3 max-w-md">
            <input type="text" className="input flex-1" value={name} onChange={e => setName(e.target.value)} />
            <button onClick={handleSaveName} disabled={saving || name === user?.name} className="btn btn-primary text-sm py-2">
              {saving ? "Lưu..." : "Lưu"}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Email đăng nhập</label>
          <input type="email" className="input max-w-md opacity-60" value={user?.email || ""} disabled />
        </div>
        <div className="pt-4 border-t border-[var(--border)]">
          <label className="form-label mb-3">Đổi mật khẩu</label>
          <div className="flex gap-3 max-w-md">
            <input type="password" className="input flex-1" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button onClick={handleChangePassword} disabled={savingPw || !newPassword} className="btn btn-primary text-sm py-2">
              {savingPw ? "Đang lưu..." : "Đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
