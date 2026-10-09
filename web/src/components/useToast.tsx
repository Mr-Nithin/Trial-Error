"use client";

import { useCallback, useEffect, useState } from "react";

type ToastState = { message: string; undo?: () => void } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((message: string, undo?: () => void) => setToast({ message, undo }), []);

  const node = toast ? (
    <div className="toast" role="status">
      <span className="grow">{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            setToast(null);
          }}
        >
          Undo
        </button>
      )}
    </div>
  ) : null;

  return { show, node };
}
