"use client";
import { createContext, useContext, useState } from "react";
import Sidebar from "./Sidebar";
import { ToastProvider } from "./Toast";
import { Menu, X } from "lucide-react";

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

export default function AuthShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <UserContext.Provider value={user}>
      <ToastProvider>
        <div className="flex min-h-screen">
          {/* Mobile overlay */}
          {mobileOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          )}

          {/* Sidebar — fixed on mobile, static on desktop */}
          <div className={`
            fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
            ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}>
            <Sidebar user={user} onClose={() => setMobileOpen(false)} />
          </div>

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* Mobile header */}
            <div className="lg:hidden sticky top-0 z-30 bg-surface-0 border-b border-surface-3 px-4 py-3 flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-surface-2 text-gray-400">
                <Menu size={20} />
              </button>
              <div className="text-sm font-bold">GM06 Investment Club</div>
            </div>
            <div className="p-4 lg:p-7 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </ToastProvider>
    </UserContext.Provider>
  );
}
