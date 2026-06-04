"use client";

import { useRef, useState, useTransition } from "react";
import { addProductAction, deleteProductAction } from "@/app/actions/products";

export default function ProductsForm({ products }: { products: string[] }) {
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addProductAction(formData);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleDelete(name: string) {
    const fd = new FormData();
    fd.set("name", name);
    setDeleteTarget(null);
    startTransition(() => deleteProductAction(fd));
  }

  return (
    <div className="space-y-4">
      {/* Add new product */}
      <form action={handleAdd} className="flex gap-2">
        <input
          ref={inputRef}
          name="name"
          type="text"
          placeholder="ชื่อสินค้าใหม่"
          required
          className="flex-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 bg-[#87DE81] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          เพิ่ม
        </button>
      </form>

      {/* Product list */}
      {products.length === 0 ? (
        <p className="text-[12px] text-[#8B8E8F] text-center py-4">ยังไม่มีสินค้า — เพิ่มด้านบนได้เลย</p>
      ) : (
        <div className="divide-y divide-[#F7F7F7] rounded-xl border border-[#E8E8E8] overflow-hidden">
          {products.map((name) => (
            <div key={name} className="flex items-center px-4 py-2.5 bg-white">
              <span className="flex-1 text-[13px] text-[#3D3D3D]">{name}</span>

              {deleteTarget === name ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#8B8E8F]">ยืนยันลบ?</span>
                  <button
                    onClick={() => handleDelete(name)}
                    disabled={pending}
                    className="text-[11px] font-semibold text-white bg-[#CC3333] px-2.5 py-1 rounded-lg hover:bg-[#B02020] disabled:opacity-50 transition-colors"
                  >
                    ลบ
                  </button>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="text-[11px] text-[#8B8E8F] px-2 py-1 rounded-lg hover:bg-[#F7F7F7] transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(name)}
                  disabled={pending}
                  className="p-1.5 rounded-lg text-[#C0C0C0] hover:text-[#CC3333] hover:bg-[#CC3333]/10 disabled:opacity-50 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
