"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const callbackUrl = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("callbackUrl") || "/dashboard"
    : "/dashboard";
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      setError("Vui lòng nhập đầy đủ");
      return;
    }
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      login: login.trim(),
      password,
      callbackUrl: safeCallbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setError("Đăng nhập chưa thành công. Vui lòng kiểm tra thông tin và thử lại.");
      setLoading(false);
    } else {
      router.push(result?.url || safeCallbackUrl);
      router.refresh();
    }
  };


  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-container">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon" style={{ background: 'transparent' }}>
              <img src="/icon.png" alt="Kian FIRE" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <h1 className="login-title">Kian FIRE</h1>
            <p className="login-subtitle">Financial Independence, Retire Early</p>
          </div>

          {/* Form */}
          {resetMode ? (
            <div className="login-form">
              <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Quên mật khẩu?</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Liên hệ <strong>Admin</strong> để được đặt lại mật khẩu.<br />
                  Admin đăng nhập vào <strong>Cài đặt → Thành viên</strong> và nhấn "Đặt lại mật khẩu".
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setResetMode(false); setError(""); }}
                className="btn btn-primary login-btn"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label className="form-label">Email / Tên đăng nhập / SĐT</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Email, username hoặc số điện thoại"
                  value={login}
                  onChange={(e) => { setLogin(e.target.value); if (error) setError(""); }}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error">{error}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary login-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="login-spinner" />
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(true); setError(""); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginTop: 12, textAlign: 'center', width: '100%' }}
              >
                Quên mật khẩu?
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="login-footer">
            <a href="https://kiantr.com" target="_blank" rel="noopener noreferrer">
              kiantran
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.3;
        }
        .login-orb-1 {
          width: 400px;
          height: 400px;
          background: #E8721E;
          top: -100px;
          right: -100px;
          animation: float 8s ease-in-out infinite;
        }
        .login-orb-2 {
          width: 300px;
          height: 300px;
          background: #F5A623;
          bottom: -80px;
          left: -80px;
          animation: float 10s ease-in-out infinite reverse;
        }
        .login-orb-3 {
          width: 200px;
          height: 200px;
          background: #ec4899;
          top: 40%;
          left: 30%;
          animation: float 12s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 20px); }
        }
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          padding: 20px;
        }
        .login-card {
          background: var(--glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 40px 32px;
          box-shadow: var(--shadow);
        }
        .login-logo {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #E8721E, #F5A623);
          border-radius: 16px;
          color: white;
          box-shadow: 0 8px 24px rgba(232, 114, 30, 0.3);
        }
        .login-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0;
          background: linear-gradient(135deg, var(--accent), #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin: 4px 0 0;
          letter-spacing: 0.02em;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .login-error {
          background: var(--danger-bg);
          color: var(--danger);
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .login-btn {
          width: 100%;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          border-radius: 14px;
        }
        .login-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
        }
        .login-footer a {
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-footer a:hover {
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
