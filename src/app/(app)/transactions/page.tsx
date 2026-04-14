import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";

export default async function TransactionsPage() {
  const session = await auth();

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <Header userName={session?.user?.name || "Kian"} />
        <Link href="/transactions/new" className="btn btn-primary">
          <Plus size={18} /> Thêm mới
        </Link>
      </div>

      <div className="card mb-6 p-4 flex gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Tìm theo ghi chú, hạng mục..." 
            className="input w-full pl-10 bg-[var(--bg-secondary)]" 
          />
        </div>
        <button className="btn btn-ghost px-4">
          <Filter size={16} />
          Lọc
        </button>
      </div>

      <div className="card min-h-[400px] flex items-center justify-center border-dashed">
        <div className="text-center">
            <div className="w-16 h-16 bg-[var(--bg-input)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
                <ReceiptText size={24} />
            </div>
            <p className="text-[var(--text-muted)] font-medium mb-4">Chưa có giao dịch nào được tải</p>
            <Link href="/transactions/new" className="text-[var(--accent)] font-semibold text-sm hover:underline">
                + Thêm giao dịch đầu tiên
            </Link>
        </div>
      </div>
    </div>
  );
}

// Just a tiny icon import workaround for the placeholder
import { ReceiptText } from "lucide-react";
