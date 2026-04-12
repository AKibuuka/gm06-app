"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { BookOpen, Plus, Trash2, Calendar } from "lucide-react";
import Modal, { FormField, inputClass, btnPrimary, btnSecondary } from "@/components/Modal";
import Confirm from "@/components/Confirm";
import { fmtDate, titleCase } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

export default function MeetingsPage() {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  useTitle("Meetings");

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", meeting_date: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    fetch("/api/meeting-notes")
      .then((r) => r.json())
      .then((d) => { setNotes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes([data, ...notes]);
      setShowCreate(false);
      setForm({ title: "", body: "", meeting_date: new Date().toISOString().split("T")[0] });
      toast?.("Meeting notes saved", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  async function handleDelete(id) {
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotes(notes.filter((n) => n.id !== id));
      toast?.("Meeting notes deleted", "success");
    } catch (e) { toast?.(e.message, "error"); }
  }

  if (loading) return <SkeletonPage cards={3} rows={4} />;

  return (
    <div className="animate-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">Meeting notes and minutes</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className={`${btnPrimary} px-4 flex items-center gap-2 text-sm`}>
            <Plus size={14} /> Add Notes
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen size={36} className="mx-auto mb-3 text-gray-600" />
          <div className="text-sm text-gray-500">No meeting notes yet</div>
          {isAdmin && <div className="text-xs text-gray-600 mt-1">Record your first meeting</div>}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const isExpanded = expanded === n.id;
            return (
              <div key={n.id} className="card">
                <button onClick={() => setExpanded(isExpanded ? null : n.id)} className="w-full text-left">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-brand-500 shrink-0" />
                        <span className="text-sm font-bold">{n.title}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 ml-5">
                        {fmtDate(n.meeting_date)} · by {titleCase(n.author?.name)}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); setConfirm({ title: "Delete Notes", message: `Delete "${n.title}"?`, onConfirm: () => handleDelete(n.id), confirmText: "Delete", danger: true }); }}
                        className="p-1.5 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-surface-3 ml-5">
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">{n.body}</div>
                  </div>
                )}
                {!isExpanded && (
                  <div className="text-xs text-gray-500 mt-2 ml-5 truncate">{n.body.slice(0, 120)}{n.body.length > 120 ? "..." : ""}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Meeting Notes">
        <form onSubmit={handleCreate} className="space-y-1">
          <FormField label="Meeting Date">
            <input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} required className={inputClass} />
          </FormField>
          <FormField label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputClass}
              placeholder="e.g. April Monthly Meeting" />
          </FormField>
          <FormField label="Notes / Minutes">
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={8} className={inputClass}
              placeholder="Record key discussions, decisions, action items..." />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
            <button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Saving..." : "Save Notes"}</button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} onConfirm={confirm?.onConfirm || (() => {})} confirmText={confirm?.confirmText || "Confirm"} danger={confirm?.danger} />
    </div>
  );
}
