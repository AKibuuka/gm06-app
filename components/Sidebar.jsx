"use client";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, PieChart, FileText, LogOut, RefreshCw, DollarSign, Settings, X, Landmark, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { CLUB_SHORT } from "@/lib/constants";
import Avatar from "./Avatar";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contributions", label: "Contributions", icon: DollarSign },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/messages", label: "Messages", icon: MessageSquare },
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
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = user?.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;

  // Fetch unread message count (lightweight endpoint)
  useEffect(() => {
    function fetchUnread() {
      fetch("/api/messages/unread")
        .then((r) => r.json())
        .then((d) => { if (d?.count !== undefined) setUnreadCount(d.count); })
        .catch(() => {});
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

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
          const badge = item.href === "/messages" && unreadCount > 0 ? unreadCount : null;
          return (
            <button key={item.href} onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-brand-700 text-white" : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"}`}>
              <Icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
              {badge && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge > 9 ? "9+" : badge}</span>}
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
        <div className="px-4 py-2 flex items-center gap-2.5">
          <Avatar name={user?.name} size={28} />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{user?.name?.split(" ").map(w=>w[0]+w.slice(1).toLowerCase()).join(" ")}</div>
            <div className="text-[10px] text-gray-500 capitalize">{user?.role}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-colors">
          <LogOut size={14} />Sign out
        </button>
      </div>
    </aside>
  );
}
