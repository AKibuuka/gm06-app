"use client";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, PieChart, FileText, LogOut, RefreshCw, DollarSign, Settings, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "./Toast";
import { CLUB_SHORT } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contributions", label: "Contributions", icon: DollarSign },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [
  { href: "/members", label: "Members", icon: Users },
  { href: "/admin", label: "Admin Panel", icon: Settings },
];

export default function Sidebar({ user, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [updating, setUpdating] = useState(false);

  const navItems = user?.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;

  function navigate(href) {
    router.push(href);
    onClose?.();
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  async function handlePriceUpdate() {
    setUpdating(true);
    try {
      const res = await fetch("/api/prices", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast?.(`Updated ${data.updated} prices`, "success");
      } else { toast?.("Price update failed", "error"); }
    } catch { toast?.("Network error", "error"); }
    setUpdating(false);
  }

  return (
    <aside className="w-60 h-screen bg-surface-1 border-r border-surface-3 flex flex-col shrink-0">
      <div className="p-5 border-b border-surface-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center text-sm font-bold text-white">G6</div>
          <div><div className="text-sm font-bold leading-tight">{CLUB_SHORT}</div><div className="text-[10px] tracking-[2px] text-gray-500">INVESTMENT CLUB</div></div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 text-gray-500 hover:text-white"><X size={18} /></button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <button key={item.href} onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-brand-700 text-white" : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"}`}>
              <Icon size={18} />{item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-surface-3 space-y-1">
        {user?.role === "admin" && (
          <button onClick={handlePriceUpdate} disabled={updating}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-gray-400 hover:bg-surface-2 hover:text-brand-500 transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={updating ? "animate-spin" : ""} />{updating ? "Updating..." : "Update Prices"}
          </button>
        )}
        <div className="px-4 py-2">
          <div className="text-xs font-medium truncate">{user?.name?.split(" ").map(w=>w[0]+w.slice(1).toLowerCase()).join(" ")}</div>
          <div className="text-[10px] text-gray-500 capitalize">{user?.role}</div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-colors">
          <LogOut size={14} />Sign out
        </button>
      </div>
    </aside>
  );
}
