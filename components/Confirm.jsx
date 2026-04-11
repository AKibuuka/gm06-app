"use client";

export default function Confirm({ open, onClose, onConfirm, title, message, confirmText = "Confirm", danger = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface-1 border border-surface-3 rounded-2xl max-w-sm w-full">
        <div className="p-6">
          <h3 className="text-base font-bold mb-2">{title}</h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 font-medium py-2.5 rounded-lg text-sm transition-colors ${danger ? "bg-red-700 hover:bg-red-800 text-white" : "bg-brand-700 hover:bg-brand-800 text-white"}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
