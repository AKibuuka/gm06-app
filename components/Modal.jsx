"use client";

export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`bg-surface-1 border border-surface-3 rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"} w-full max-h-[85vh] overflow-auto`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-surface-3 sticky top-0 bg-surface-1 z-10 rounded-t-2xl">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-gray-500 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

export const inputClass = "w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-700 transition-colors";
export const selectClass = "w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-700 transition-colors cursor-pointer";
export const btnPrimary = "bg-brand-700 hover:bg-brand-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50";
export const btnSecondary = "bg-surface-2 hover:bg-surface-3 border border-surface-3 text-white font-medium py-2.5 rounded-lg text-sm transition-colors";
