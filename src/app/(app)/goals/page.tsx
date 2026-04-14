"use client";

import { Shield, TrendingUp, CheckCircle, Target, ArrowRight } from "lucide-react";
import { JOURNEY_LEVELS } from "@/lib/constants";

export default function GoalsPage() {
  
  // Logic hành trình tài chính - Fixed for demo frontend mock
  const currentLevel = 3;
  const activeLevelInfo = JOURNEY_LEVELS.find(l => l.level === currentLevel) || JOURNEY_LEVELS[2];

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Hành Trình FIRE</h1>
        <p className="text-sm text-[var(--text-muted)]">Kiểm soát dòng tiền, tích luỹ tài sản và đạt tự do tài chính</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Journey Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glass relative overflow-hidden bg-gradient-to-br from-[var(--bg-card)] to-[#1e1b4b]">
            <div className="absolute opacity-10 -right-10 -bottom-10 pointer-events-none">
                <Shield size={160} />
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg">
                    <Shield size={24} />
                </div>
                <div>
                   <div className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-widest mb-0.5">Lv.{currentLevel} Hành Trình</div>
                   <h2 className="text-xl font-extrabold">{activeLevelInfo.name}</h2>
                </div>
            </div>

            <p className="text-sm text-indigo-200 mb-6 font-medium leading-relaxed max-w-md">
               {activeLevelInfo.description}
            </p>

            <div className="space-y-4 relative z-10">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={20} className="text-[var(--success)]" />
                        <div>
                           <div className="font-semibold text-sm text-white">Quỹ khẩn cấp 6 tháng</div>
                           <div className="text-[11px] text-indigo-300">Hoàn thành</div>
                        </div>
                    </div>
                    <span className="badge badge-success px-3">100%</span>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Target size={20} className="text-[#8B5CF6]" />
                        <div>
                           <div className="font-semibold text-sm text-white">Đầu tư tích lũy</div>
                           <div className="text-[11px] text-indigo-300">Đang triển khai (Mục tiêu: Đạt 10 năm chi phí)</div>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-[#8B5CF6]/20 text-[#a78bfa] rounded-full text-xs font-bold border border-[#8B5CF6]/30">
                        15%
                    </span>
                </div>
            </div>
          </div>

          <div className="card">
              <h3 className="section-label mb-4">Các Mục Tiêu Cụ Thể</h3>
              <div className="space-y-4">
                  <div className="p-3 border border-[var(--border)] rounded-xl hover:border-[var(--accent)] transition-all cursor-pointer group">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-[var(--danger-bg)] text-[var(--danger)] flex items-center justify-center">
                                 🚘
                             </div>
                             <span className="font-bold text-sm">Mua xe ô tô</span>
                        </div>
                        <span className="text-xs font-bold font-mono">450tr / 600tr</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-input)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)] transition-all duration-1000" style={{ width: '75%' }}></div>
                      </div>
                  </div>
              </div>
          </div>
        </div>

        {/* Right Col: FIRE Calculator */}
        <div className="space-y-6">
            <div className="card border-[var(--border-focus)] shadow-[0_0_20px_rgba(99,102,241,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-muted)] rounded-bl-full pointer-events-none"></div>
                
                <h3 className="section-label text-[var(--accent)] mb-4">Mô phỏng FIRE</h3>
                
                <div className="mb-6">
                    <div className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Tuổi Tự Do Tài Chính</div>
                    <div className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)]">
                        40
                        <span className="text-sm font-semibold text-[var(--text-muted)] ml-2 uppercase tracking-wide bg-clip-text bg-none">Năm tuổi</span>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                   <div className="flex justify-between items-center pb-3 border-b border-[var(--border-light)]">
                       <span className="text-sm text-[var(--text-secondary)]">Lợi nhuận kỳ vọng</span>
                       <span className="font-bold">12%/năm</span>
                   </div>
                   <div className="flex justify-between items-center pb-3 border-b border-[var(--border-light)]">
                       <span className="text-sm text-[var(--text-secondary)]">Lạm phát</span>
                       <span className="font-bold">3.5%/năm</span>
                   </div>
                   <div className="flex justify-between items-center pb-3 border-b border-[var(--border-light)]">
                       <span className="text-sm text-[var(--text-secondary)]">Con số FIRE</span>
                       <span className="font-bold text-[var(--success)]">12 Tỷ VND</span>
                   </div>
                </div>

                <button className="w-full btn bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--text-secondary)]">
                    Hiệu chỉnh kế hoạch <ArrowRight size={16} />
                </button>
            </div>
            
            <div className="card bg-[var(--info-bg)] border-none">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--info)] text-white flex items-center justify-center shrink-0">
                        💡
                    </div>
                    <div>
                        <div className="text-sm font-bold text-[var(--info)] mb-1">Snowball Logic</div>
                        <p className="text-xs text-[var(--info)] opacity-80 leading-relaxed font-medium">
                            Duy trì tỷ lệ tiết kiệm 50% và tái đầu tư lợi nhuận sẽ giảm một nửa thời gian tiến tới FIRE của bạn. Hòn tuyết đang lớn dần mỗi ngày.
                        </p>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
