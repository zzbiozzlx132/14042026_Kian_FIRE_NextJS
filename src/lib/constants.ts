/** Journey levels - 5 cấp độ tài chính */
export const JOURNEY_LEVELS = [
  { level: 1, name: "Sinh tồn", description: "Bắt đầu kiểm soát tài chính", color: "#EF4444", icon: "shield-alert" },
  { level: 2, name: "Ổn định", description: "Không còn nợ lãi cao, có quỹ khẩn cấp 3 tháng", color: "#F59E0B", icon: "shield" },
  { level: 3, name: "Xây nền tảng", description: "Quỹ khẩn cấp 6 tháng, sẵn sàng đầu tư", color: "#3B82F6", icon: "shield-check" },
  { level: 4, name: "Phát triển", description: "Đầu tư > 12 tháng chi tiêu", color: "#8B5CF6", icon: "trending-up" },
  { level: 5, name: "Tự do tài chính", description: "Đạt mục tiêu FIRE", color: "#10B981", icon: "crown" },
];

/** Default categories to seed */
export const DEFAULT_CATEGORIES = [
  // Chi tiêu
  { name: "Ăn uống", type: "EXPENSE" as const, icon: "utensils", sortOrder: 1 },
  { name: "Đi lại", type: "EXPENSE" as const, icon: "car", sortOrder: 2 },
  { name: "Nhà ở", type: "EXPENSE" as const, icon: "home", sortOrder: 3 },
  { name: "Điện nước", type: "EXPENSE" as const, icon: "zap", sortOrder: 4 },
  { name: "Internet & ĐT", type: "EXPENSE" as const, icon: "wifi", sortOrder: 5 },
  { name: "Sức khỏe", type: "EXPENSE" as const, icon: "heart-pulse", sortOrder: 6 },
  { name: "Giáo dục", type: "EXPENSE" as const, icon: "graduation-cap", sortOrder: 7 },
  { name: "Giải trí", type: "EXPENSE" as const, icon: "gamepad-2", sortOrder: 8 },
  { name: "Mua sắm", type: "EXPENSE" as const, icon: "shopping-bag", sortOrder: 9 },
  { name: "Làm đẹp", type: "EXPENSE" as const, icon: "sparkles", sortOrder: 10 },
  { name: "Gia đình", type: "EXPENSE" as const, icon: "users", sortOrder: 11 },
  { name: "Chi tiêu khác", type: "EXPENSE" as const, icon: "more-horizontal", sortOrder: 12 },
  // Thu nhập
  { name: "Lương", type: "INCOME" as const, icon: "banknote", sortOrder: 1 },
  { name: "Thưởng", type: "INCOME" as const, icon: "gift", sortOrder: 2 },
  { name: "Đầu tư", type: "INCOME" as const, icon: "trending-up", sortOrder: 3 },
  { name: "Freelance", type: "INCOME" as const, icon: "laptop", sortOrder: 4 },
  { name: "Thu nhập khác", type: "INCOME" as const, icon: "plus-circle", sortOrder: 5 },
  // Luân chuyển
  { name: "Chuyển khoản", type: "TRANSFER" as const, icon: "arrow-right-left", sortOrder: 1 },
];

/** Quick amount buttons */
export const QUICK_AMOUNTS = [
  { label: "10K", value: 10_000 },
  { label: "20K", value: 20_000 },
  { label: "50K", value: 50_000 },
  { label: "100K", value: 100_000 },
  { label: "200K", value: 200_000 },
  { label: "500K", value: 500_000 },
  { label: "1M", value: 1_000_000 },
  { label: "2M", value: 2_000_000 },
];

/** Budget types */
export const BUDGET_TYPE_LABELS: Record<string, string> = {
  EXPENSE_LIVING: "Chi tiêu sinh hoạt",
  DEBT_PAYMENT: "Trả nợ",
  CREDIT_CARD_PAYMENT: "Trả thẻ tín dụng",
  INVEST: "Đầu tư",
  GOAL_FUND: "Quỹ mục tiêu",
  SAVINGS: "Tiết kiệm",
  OTHER: "Khác",
};

/** Chart colors palette */
export const CHART_COLORS = [
  "#059669", "#D97706", "#DC2626", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#EF4444",
  "#10B981", "#F59E0B",
];

/** Wake up quotes (giữ từ app cũ) */
export const WAKE_UP_QUOTES = [
  "Tiền bạn tiêu hôm nay là tự do của bạn ngày mai.",
  "Lương nuôi bạn một tháng, kỷ luật nuôi bạn cả đời.",
  "Mua thứ không cần sẽ bán đi tương lai mình cần.",
  "Làm nhiều không giàu bằng giữ được tiền và đầu tư đúng.",
  "Người thắng tài chính không phải kiếm nhanh, mà là sống có kế hoạch.",
  "Bỏ 30 phút mỗi tuần review giao dịch, hơn 3 năm tiếc nuối.",
  "Chi tiêu theo cảm xúc làm nghèo nhanh hơn lạm phát.",
  "Bạn 1999, thời gian còn nhiều nhưng lãi kép không chờ ai.",
];
