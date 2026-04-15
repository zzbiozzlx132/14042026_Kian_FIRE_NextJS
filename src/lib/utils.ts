import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as Vietnamese currency (e.g., 1.500.000 đ) */
export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0\u00a0đ";
  const num = Number(n);
  const isNegative = num < 0;
  const abs = Math.abs(Math.round(num));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (isNegative ? "-" : "") + formatted + "\u00a0đ";
}

/** Format number as compact money (e.g., 1.5M, 500K) */
export function fmtMoneyCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

/** Format date to dd/mm/yyyy */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN");
}

/** Format date to yyyy-mm-dd for input fields */
export function toInputDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

/** Get today as yyyy-mm-dd */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Parse raw amount input (remove dots/commas, return number) */
export function parseAmount(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

/** Format number with dots as thousand separator for input display */
export function formatAmountDisplay(n: number): string {
  if (!n || n <= 0) return "";
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Calculate percentage safely */
export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/** Readable enum value mapping */
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK: "Ngân hàng",
  CREDIT_CARD: "Thẻ tín dụng",
  E_WALLET: "Ví điện tử",
  SAVINGS: "Tiết kiệm",
  INVESTMENT: "Đầu tư",
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  EXPENSE: "Chi tiêu",
  INCOME: "Thu nhập",
  TRANSFER: "Luân chuyển",
};

export const DEBT_TYPE_LABELS: Record<string, string> = {
  LEND: "Cho vay",
  BORROW: "Đi vay",
};

export const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  GOLD: "Vàng",
  STOCK: "Chứng khoán",
  CRYPTO: "Crypto",
  REAL_ESTATE: "Bất động sản",
  TERM_DEPOSIT: "Tiết kiệm kỳ hạn",
  OTHER: "Khác",
};

export const GOAL_TYPE_LABELS: Record<string, string> = {
  EMERGENCY: "Quỹ khẩn cấp",
  DEBT_FREE: "Hết nợ",
  SAVINGS: "Tiết kiệm",
  INVEST: "Đầu tư",
  FIRE: "Tự do tài chính",
  PASSIVE: "Thu nhập thụ động",
  EDUCATION: "Học tập",
  HEALTH: "Sức khỏe",
  RETIRE: "Nghỉ hưu",
  BUSINESS: "Kinh doanh",
};

export const ESSENTIAL_LABELS: Record<string, string> = {
  ESSENTIAL: "Thiết yếu",
  NON_ESSENTIAL: "Không thiết yếu",
};

export const RATING_LABELS: Record<string, string> = {
  WORTHY: "Xứng đáng",
  NORMAL: "Bình thường",
  WASTEFUL: "Phí tiền",
};
