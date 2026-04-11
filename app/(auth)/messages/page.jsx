"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { MessageSquare, Send, ArrowLeft, Plus } from "lucide-react";
import Modal, { FormField, selectClass, btnPrimary, btnSecondary } from "@/components/Modal";
import { fmtDate } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";
import Avatar from "@/components/Avatar";

export default function MessagesPage() {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null); // partner_id
  const [activeMessages, setActiveMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const bottomRef = useRef(null);
  useTitle("Messages");

  useEffect(() => {
    Promise.all([
      fetch("/api/messages").then((r) => r.json()),
      fetch("/api/members").then((r) => r.json()),
    ]).then(([c, m]) => {
      setConversations(Array.isArray(c) ? c : []);
      setMembers(Array.isArray(m) ? m : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeConvo) return;
    fetch(`/api/messages?with=${activeConvo}`)
      .then((r) => r.json())
      .then((msgs) => {
        setActiveMessages(Array.isArray(msgs) ? msgs : []);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });
    // Mark as read in conversation list
    setConversations((prev) => prev.map((c) => c.partner_id === activeConvo ? { ...c, unread: 0 } : c));
  }, [activeConvo]);

  async function handleSend(e) {
    e.preventDefault();
    if (!newMsg.trim() || !activeConvo) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: activeConvo, body: newMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveMessages((prev) => [...prev, data]);
      setNewMsg("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { toast?.(e.message, "error"); }
    setSending(false);
  }

  function startNewConversation() {
    if (!newRecipient) return;
    setActiveConvo(newRecipient);
    setShowNew(false);
    setNewRecipient("");
    // Add to conversations if not already there
    const existing = conversations.find((c) => c.partner_id === newRecipient);
    if (!existing) {
      const member = members.find((m) => m.id === newRecipient);
      setConversations((prev) => [{ partner_id: newRecipient, partner_name: member?.name || "Unknown", last_message: "", last_message_at: new Date().toISOString(), unread: 0 }, ...prev]);
    }
  }

  function titleCase(name) {
    return name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "";
  }

  if (loading) return <SkeletonPage cards={0} rows={5} />;

  const activePartner = conversations.find((c) => c.partner_id === activeConvo) || members.find((m) => m.id === activeConvo);
  const partnerName = titleCase(activePartner?.partner_name || activePartner?.name || "");

  return (
    <div className="animate-in">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-gray-500 mt-1">Direct messages with club members</p>
        </div>
        <button onClick={() => setShowNew(true)} className={`${btnPrimary} px-4 flex items-center gap-2 text-sm`}>
          <Plus size={14} /> New Message
        </button>
      </div>

      <div className="card p-0 overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
        <div className="flex h-full">
          {/* Conversation list */}
          <div className={`${activeConvo ? "hidden lg:block" : ""} w-full lg:w-72 border-r border-surface-3 overflow-auto`}>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No conversations yet</div>
            ) : conversations.map((c) => (
              <button key={c.partner_id} onClick={() => setActiveConvo(c.partner_id)}
                className={`w-full text-left px-4 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors ${activeConvo === c.partner_id ? "bg-surface-2" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar name={c.partner_name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium truncate">{titleCase(c.partner_name)}</div>
                      {c.unread > 0 && <span className="bg-brand-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">{c.unread}</span>}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{c.last_message || "No messages"}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{c.last_message_at ? fmtDate(c.last_message_at) : ""}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Message thread */}
          {activeConvo ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="px-4 py-3 border-b border-surface-3 flex items-center gap-3 shrink-0">
                <button onClick={() => setActiveConvo(null)} className="lg:hidden text-gray-400 hover:text-white"><ArrowLeft size={18} /></button>
                <div className="text-sm font-semibold">{partnerName}</div>
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {activeMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-brand-700 text-white rounded-br-md" : "bg-surface-2 text-gray-200 rounded-bl-md"}`}>
                        <div className="text-sm whitespace-pre-wrap break-words">{msg.body}</div>
                        <div className={`text-[10px] mt-1 ${isMe ? "text-brand-300" : "text-gray-500"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              {/* Input */}
              <form onSubmit={handleSend} className="p-3 border-t border-surface-3 flex gap-2 shrink-0">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a message..."
                  className="flex-1 bg-surface-2 border border-surface-3 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-700 transition-colors" />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  className="bg-brand-700 hover:bg-brand-800 disabled:bg-brand-800/50 text-white p-2.5 rounded-xl transition-colors">
                  <Send size={16} />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 hidden lg:flex items-center justify-center text-gray-500 text-sm">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto mb-3 text-gray-600" />
                <div>Select a conversation or start a new one</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Message">
        <FormField label="To">
          <select value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} required className={selectClass}>
            <option value="">Select a member...</option>
            {members.filter((m) => m.id !== user?.id).map((m) => (
              <option key={m.id} value={m.id}>{titleCase(m.name)}</option>
            ))}
          </select>
        </FormField>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => setShowNew(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
          <button type="button" onClick={startNewConversation} disabled={!newRecipient} className={`flex-1 ${btnPrimary}`}>Start Chat</button>
        </div>
      </Modal>
    </div>
  );
}
