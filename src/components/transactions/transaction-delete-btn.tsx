"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function TransactionDeleteButton({ id, name }: { id: string, name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("API failed");
      
      toast.success("Đã xoá giao dịch");
      setIsOpen(false);
      router.refresh();
    } catch (e) {
      toast.error("Lỗi khi xoá");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
      >
        <Trash2 size={16} />
      </button>

      {/* Kianis Modal bọc kính đen */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="card w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Xác nhận xoá</h3>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              Bạn có chắc muốn xoá giao dịch <strong className="text-[var(--text-primary)]">{name}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost flex-1"
                disabled={loading}
              >
                Hủy
              </button>
              <button 
                onClick={handleDelete}
                className="btn btn-danger flex-1"
                disabled={loading}
              >
                {loading ? "Đang xoá..." : "Xoá luôn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
