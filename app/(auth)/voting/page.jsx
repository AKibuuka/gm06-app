"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { Vote, Plus, CheckCircle2, Clock, Archive, X, ChevronDown, ChevronUp } from "lucide-react";
import Modal, { FormField, inputClass, btnPrimary, btnSecondary } from "@/components/Modal";
import Confirm from "@/components/Confirm";
import { fmtDate } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

function titleCase(name) {
  return name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "";
}

export default function VotingPage() {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  useTitle("Voting");

  const [ballots, setBallots] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", options: ["", ""], allow_multiple: false });
  const [expandedDecision, setExpandedDecision] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ballots").then((r) => r.json()),
      fetch("/api/decisions").then((r) => r.json()),
    ]).then(([b, d]) => {
      setBallots(Array.isArray(b) ? b : []);
      setDecisions(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const openBallots = ballots.filter((b) => b.status === "open");
  const closedBallots = ballots.filter((b) => b.status === "closed");

  async function handleVote(ballotId, choice) {
    try {
      const res = await fetch("/api/ballots", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ballotId, action: "vote", choice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast?.("Vote recorded!", "success");
      // Refresh ballots
      const updated = await fetch("/api/ballots").then((r) => r.json());
      if (Array.isArray(updated)) setBallots(updated);
    } catch (e) { toast?.(e.message, "error"); }
  }

  async function handleClose(ballotId) {
    try {
      const res = await fetch("/api/ballots", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ballotId, action: "close" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast?.(data.message || "Ballot closed", "success");
      // Refresh both
      const [b, d] = await Promise.all([
        fetch("/api/ballots").then((r) => r.json()),
        fetch("/api/decisions").then((r) => r.json()),
      ]);
      if (Array.isArray(b)) setBallots(b);
      if (Array.isArray(d)) setDecisions(d);
    } catch (e) { toast?.(e.message, "error"); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const opts = form.options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) { toast?.("Need at least 2 options", "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ballots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, options: opts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBallots((prev) => [{ ...data, results: {}, total_voters: 0, member_count: 0, my_votes: [] }, ...prev]);
      setShowCreate(false);
      setForm({ title: "", description: "", options: ["", ""], allow_multiple: false });
      toast?.("Ballot created", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  async function handleDelete(ballotId) {
    try {
      const res = await fetch("/api/ballots", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ballotId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setBallots((prev) => prev.filter((b) => b.id !== ballotId));
      toast?.("Ballot deleted", "success");
    } catch (e) { toast?.(e.message, "error"); }
  }

  function updateOption(idx, val) {
    const opts = [...form.options];
    opts[idx] = val;
    setForm({ ...form, options: opts });
  }

  function addOption() {
    if (form.options.length >= 10) return;
    setForm({ ...form, options: [...form.options, ""] });
  }

  function removeOption(idx) {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, i) => i !== idx) });
  }

  if (loading) return <SkeletonPage cards={3} rows={4} />;

  return (
    <div className="animate-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Voting</h1>
          <p className="text-sm text-gray-500 mt-1">Vote on club matters and view past decisions</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className={`${btnPrimary} px-4 flex items-center gap-2 text-sm`}>
            <Plus size={14} /> Create Ballot
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-1 border border-surface-3 rounded-xl p-1 w-fit">
        <button onClick={() => setTab("active")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "active" ? "bg-brand-700 text-white" : "text-gray-400 hover:text-white hover:bg-surface-2"}`}>
          <Clock size={14} /> Active ({openBallots.length})
        </button>
        <button onClick={() => setTab("decisions")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "decisions" ? "bg-brand-700 text-white" : "text-gray-400 hover:text-white hover:bg-surface-2"}`}>
          <Archive size={14} /> Decisions ({decisions.length})
        </button>
      </div>

      {/* ═══ ACTIVE BALLOTS ═══ */}
      {tab === "active" && (
        <div>
          {openBallots.length === 0 ? (
            <div className="card text-center py-12">
              <Vote size={36} className="mx-auto mb-3 text-gray-600" />
              <div className="text-sm text-gray-500">No active ballots</div>
              {isAdmin && <div className="text-xs text-gray-600 mt-1">Create one to start a vote</div>}
            </div>
          ) : (
            <div className="space-y-4">
              {openBallots.map((b) => {
                const totalVotes = Object.values(b.results || {}).reduce((s, c) => s + c, 0);
                const hasVoted = b.my_votes?.length > 0;
                const participation = b.member_count > 0 ? Math.round((b.total_voters / b.member_count) * 100) : 0;

                return (
                  <div key={b.id} className="card" style={{ borderColor: "rgba(15,118,110,0.2)" }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-base font-bold">{b.title}</div>
                        {b.description && <div className="text-xs text-gray-400 mt-1">{b.description}</div>}
                        <div className="text-[11px] text-gray-500 mt-1">
                          Created by {titleCase(b.creator?.name)} · {fmtDate(b.created_at)}
                          {b.allow_multiple && <span className="ml-2 text-brand-500">(multiple choice)</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-500">{b.total_voters}/{b.member_count} voted</div>
                        <div className="text-[11px] text-gray-600">{participation}% participation</div>
                      </div>
                    </div>

                    {/* Options with vote buttons and live results */}
                    <div className="space-y-2 mb-3">
                      {(b.options || []).map((opt) => {
                        const count = b.results?.[opt] || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const isMyVote = b.my_votes?.includes(opt);

                        return (
                          <button key={opt} onClick={() => handleVote(b.id, opt)} disabled={!b.allow_multiple && hasVoted && isMyVote}
                            className={`w-full text-left relative overflow-hidden rounded-lg border transition-colors ${isMyVote ? "border-brand-600 bg-brand-900/10" : "border-surface-3 hover:border-brand-700/50 bg-surface-2"}`}>
                            {/* Progress bar background */}
                            <div className="absolute inset-0 bg-brand-700/10 transition-all" style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isMyVote && <CheckCircle2 size={14} className="text-brand-500 shrink-0" />}
                                <span className="text-sm font-medium">{opt}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-500">{count} vote{count !== 1 ? "s" : ""}</span>
                                <span className="text-xs font-mono font-semibold text-gray-400 w-10 text-right">{pct}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {hasVoted && !b.allow_multiple && (
                      <div className="text-[11px] text-brand-500 mb-2">You voted: {b.my_votes.join(", ")}</div>
                    )}

                    {isAdmin && (
                      <div className="flex gap-2 pt-2 border-t border-surface-3">
                        <button onClick={() => setConfirm({ title: "Close Ballot", message: `Close "${b.title}" and record the decision? No more votes will be accepted.`, onConfirm: () => handleClose(b.id), confirmText: "Close Ballot" })}
                          className={`${btnSecondary} px-3 text-xs`}>Close Ballot</button>
                        <button onClick={() => setConfirm({ title: "Delete Ballot", message: `Delete "${b.title}"? All votes will be lost.`, onConfirm: () => handleDelete(b.id), confirmText: "Delete", danger: true })}
                          className="text-xs text-gray-500 hover:text-red-400 px-3 py-1.5">Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ DECISIONS ═══ */}
      {tab === "decisions" && (
        <div>
          {decisions.length === 0 ? (
            <div className="card text-center py-12">
              <Archive size={36} className="mx-auto mb-3 text-gray-600" />
              <div className="text-sm text-gray-500">No decisions recorded yet</div>
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => {
                const expanded = expandedDecision === d.id;
                const tally = d.details?.tally || {};
                const totalVotes = d.details?.total_votes || 0;

                return (
                  <div key={d.id} className="card">
                    <button onClick={() => setExpandedDecision(expanded ? null : d.id)} className="w-full text-left">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">{d.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded bg-green-900/20 text-green-400 text-[11px] font-semibold">Decided</span>
                            <span className="text-xs text-gray-500">{fmtDate(d.decided_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-brand-500">{d.outcome}</div>
                            <div className="text-[11px] text-gray-500">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</div>
                          </div>
                          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                      </div>
                    </button>

                    {expanded && Object.keys(tally).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-3 space-y-2">
                        {Object.entries(tally).sort(([, a], [, b]) => b - a).map(([opt, count]) => {
                          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                          const isWinner = opt === d.outcome || d.outcome.includes(opt);
                          return (
                            <div key={opt} className="relative overflow-hidden rounded-lg bg-surface-2">
                              <div className={`absolute inset-0 ${isWinner ? "bg-brand-700/15" : "bg-gray-700/10"}`} style={{ width: `${pct}%` }} />
                              <div className="relative flex items-center justify-between px-4 py-2">
                                <div className="flex items-center gap-2">
                                  {isWinner && <CheckCircle2 size={12} className="text-brand-500" />}
                                  <span className={`text-sm ${isWinner ? "font-semibold" : ""}`}>{opt}</span>
                                </div>
                                <span className="text-xs font-mono text-gray-400">{count} ({pct}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Ballot Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Ballot">
        <form onSubmit={handleCreate} className="space-y-1">
          <FormField label="Question / Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputClass}
              placeholder="e.g. Should we invest in real estate?" />
          </FormField>
          <FormField label="Description (optional)">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass}
              placeholder="Additional context for voters..." />
          </FormField>
          <FormField label="Options">
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={opt} onChange={(e) => updateOption(i, e.target.value)} required className={inputClass}
                    placeholder={`Option ${i + 1}`} />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="text-gray-500 hover:text-red-400 p-1 shrink-0"><X size={14} /></button>
                  )}
                </div>
              ))}
              {form.options.length < 10 && (
                <button type="button" onClick={addOption} className="text-xs text-brand-500 hover:text-brand-400">+ Add option</button>
              )}
            </div>
          </FormField>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer py-2">
            <input type="checkbox" checked={form.allow_multiple} onChange={(e) => setForm({ ...form, allow_multiple: e.target.checked })} className="rounded" />
            Allow members to vote for multiple options
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
            <button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Creating..." : "Create Ballot"}</button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} onConfirm={confirm?.onConfirm || (() => {})} confirmText={confirm?.confirmText || "Confirm"} danger={confirm?.danger} />
    </div>
  );
}
