"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, DollarSign, Landmark } from "lucide-react";
import { fmtUGX, fmtDate } from "@/lib/format";
import Avatar, { titleCase } from "./Avatar";

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch { setResults(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function navigate(path) {
    router.push(path);
    onClose();
  }

  const hasResults = results && (results.members?.length || results.contributions?.length || results.loans?.length);
  const noResults = results && !hasResults && query.length >= 2;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-lg max-h-[60vh] flex flex-col">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-3">
          <Search size={18} className="text-gray-500 shrink-0" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members, contributions, loans..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500" />
          {query && <button onClick={() => { setQuery(""); setResults(null); }} className="text-gray-500 hover:text-white"><X size={16} /></button>}
        </div>

        {/* Results */}
        <div className="overflow-auto flex-1">
          {loading && <div className="p-4 text-center text-gray-500 text-xs">Searching...</div>}

          {noResults && <div className="p-6 text-center text-gray-500 text-sm">No results for "{query}"</div>}

          {hasResults && (
            <div className="p-2">
              {/* Members */}
              {results.members?.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-gray-500 font-semibold tracking-wide px-2 py-1">MEMBERS</div>
                  {results.members.map((m) => (
                    <button key={m.id} onClick={() => navigate("/members")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left">
                      <Avatar name={m.name} size={28} />
                      <div><div className="text-sm">{titleCase(m.name)}</div><div className="text-[11px] text-gray-500">{m.email}</div></div>
                    </button>
                  ))}
                </div>
              )}

              {/* Contributions */}
              {results.contributions?.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-gray-500 font-semibold tracking-wide px-2 py-1">CONTRIBUTIONS</div>
                  {results.contributions.map((c) => (
                    <button key={c.id} onClick={() => navigate("/contributions")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left">
                      <div className="w-7 h-7 rounded-lg bg-green-900/30 flex items-center justify-center shrink-0"><DollarSign size={14} className="text-green-400" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{fmtUGX(c.amount)} — <span className="capitalize">{c.type}</span></div>
                        <div className="text-[11px] text-gray-500 truncate">{c.description || c.bank_ref || fmtDate(c.date)}{c.members?.name ? ` · ${titleCase(c.members.name)}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Loans */}
              {results.loans?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold tracking-wide px-2 py-1">LOANS</div>
                  {results.loans.map((l) => (
                    <button key={l.id} onClick={() => navigate("/loans")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left">
                      <div className="w-7 h-7 rounded-lg bg-blue-900/30 flex items-center justify-center shrink-0"><Landmark size={14} className="text-blue-400" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{fmtUGX(l.amount)} — <span className="capitalize">{l.status}</span></div>
                        <div className="text-[11px] text-gray-500 truncate">{l.reason || ""}{l.members?.name ? ` · ${titleCase(l.members.name)}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !results && (
            <div className="p-6 text-center text-gray-500 text-xs">Type at least 2 characters to search</div>
          )}
        </div>

        {/* Keyboard hint */}
        <div className="px-4 py-2 border-t border-surface-3 text-[10px] text-gray-600 text-center">Press ESC to close</div>
      </div>
    </div>
  );
}
