"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle };
const COLORS = {
  success: "bg-green-900/90 border-green-700/50 text-green-200",
  error: "bg-red-900/90 border-red-700/50 text-red-200",
  warning: "bg-amber-900/90 border-amber-700/50 text-amber-200",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] space-y-2 max-w-sm">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || ICONS.success;
          return (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm animate-in ${COLORS[t.type]}`}>
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
