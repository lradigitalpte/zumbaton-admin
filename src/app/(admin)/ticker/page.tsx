"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Message templates – one click to use. Descriptions are user-friendly; messages use placeholders that the site fills in.
const MESSAGE_TEMPLATES = [
  {
    label: "Early Bird – spots left & discount",
    description: "Updates automatically with current spots and 10% off for 2 months.",
    message: "Early Bird: {{EARLY_BIRD_REMAINING}} spots left – Get {{EARLY_BIRD_DISCOUNT}}% off for {{EARLY_BIRD_MONTHS}} months!",
  },
  {
    label: "Early Bird – short",
    description: "Just spots left. Hides when no spots remain.",
    message: "Early Bird: {{EARLY_BIRD_REMAINING}} spots left – 10% off for 2 months!",
  },
  {
    label: "New class",
    description: "Static message you can edit.",
    message: "New class this week! Book your spot.",
  },
  {
    label: "Holiday / closure",
    description: "Static message you can edit.",
    message: "Check our schedule for holiday hours. Book in advance!",
  },
  {
    label: "General promo",
    description: "Static message you can edit.",
    message: "Limited spots – book your class today!",
  },
] as const;

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[148px] flex-col rounded-[28px] p-5 sm:p-6";

function MessageEditor({
  message,
  onChange,
}: {
  message: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-neutral-800 dark:text-white/90">Start from a template</p>
        <div className="mt-2 space-y-2">
          {MESSAGE_TEMPLATES.map((template) => {
            const selected = message === template.message;
            return (
              <button
                key={template.label}
                type="button"
                onClick={() => onChange(template.message)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${selected ? "border-[#d5e45c] bg-[#E4F56C] text-neutral-950" : "border-neutral-200 bg-white text-neutral-950 dark:border-white/10 dark:bg-gray-800 dark:text-white"}`}
              >
                <span className="block text-sm font-semibold">{template.label}</span>
                <span className={`mt-0.5 block text-xs ${selected ? "text-neutral-950/70" : "text-neutral-500"}`}>{template.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-800 dark:text-white/90">Message</label>
        <textarea
          value={message}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or write your own"
          rows={4}
          className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white"
        />
        <p className="mt-2 text-xs text-neutral-500">Words in {"{{ }}"} are filled on the website. Early Bird spots and the discount stay current.</p>
      </div>
    </div>
  );
}

export default function TickerPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get<Announcement[]>("/api/announcements");
      if (res.error) {
        showToast(res.error.message || "Failed to load announcements", "error");
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async () => {
    const msg = newMessage.trim();
    if (!msg) {
      showToast("Enter a message", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<Announcement>("/api/announcements", { message: msg, is_active: true });
      if (res.error) {
        showToast(res.error.message || "Failed to add", "error");
        return;
      }
      showToast("Announcement added", "success");
      setAddOpen(false);
      setNewMessage("");
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const msg = newMessage.trim();
    if (!msg) {
      showToast("Enter a message", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<Announcement>(`/api/announcements/${editItem.id}`, { message: msg });
      if (res.error) {
        showToast(res.error.message || "Failed to update", "error");
        return;
      }
      showToast("Updated", "success");
      setEditItem(null);
      setNewMessage("");
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: Announcement) => {
    setTogglingId(item.id);
    try {
      const res = await api.patch<Announcement>(`/api/announcements/${item.id}`, { is_active: !item.is_active });
      if (res.error) {
        showToast(res.error.message || "Failed to update", "error");
        return;
      }
      showToast(item.is_active ? "Hidden from ticker" : "Shown on ticker", "success");
      fetchItems();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await api.delete(`/api/announcements/${id}`);
      if (res.error) {
        showToast(res.error.message || "Failed to delete", "error");
        return;
      }
      showToast("Deleted", "success");
      setEditItem(null);
      fetchItems();
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (item: Announcement) => {
    setEditItem(item);
    setNewMessage(item.message);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const activeCount = items.filter((item) => item.is_active).length;
  const activePreview = items.filter((item) => item.is_active).map((item) => item.message).join("   ·   ");
  const panelOpen = addOpen || !!editItem;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Ticker</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Active messages scroll across the website header. Hidden ones stay here until you turn them on.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditItem(null);
            setNewMessage("");
            setAddOpen(true);
          }}
          className="rounded-full bg-[#E4F56C] px-4 py-2 text-xs font-semibold text-neutral-950"
        >
          Add announcement
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950`}>
          <p className="text-sm font-medium">On the site</p>
          <p className="mt-4 text-4xl font-semibold leading-none tracking-tight">{loading ? "—" : activeCount}</p>
          <p className="mt-2 text-xs text-neutral-950/60">Active messages in the header</p>
        </div>
        <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white`}>
          <p className="text-sm font-medium text-white/70">Hidden</p>
          <p className="mt-4 text-4xl font-semibold leading-none tracking-tight">{loading ? "—" : items.length - activeCount}</p>
          <p className="mt-2 text-xs text-white/50">Saved, not shown</p>
        </div>
        <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
          <p className="text-sm font-medium text-neutral-600 dark:text-white/70">All messages</p>
          <p className="mt-4 text-4xl font-semibold leading-none tracking-tight">{loading ? "—" : items.length}</p>
          <p className="mt-2 text-xs text-neutral-400">Templates or your own wording</p>
        </div>
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="bg-neutral-950 px-5 py-4 text-white sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">Live on the website</p>
          <p className="mt-2 truncate text-sm">
            {loading ? "Loading the ticker." : activePreview || "Nothing is active, so the header ticker is empty."}
          </p>
        </div>
      </section>

      {loading ? (
        <div className={`${card} h-28 animate-pulse`} />
      ) : items.length === 0 ? (
        <section className={`${card} px-6 py-12 text-center`}>
          <p className="text-sm font-medium text-neutral-950 dark:text-white">No announcements yet</p>
          <p className="mt-1 text-sm text-neutral-500">Add one to show in the header ticker.</p>
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">{item.message}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {item.is_active ? "Showing on the website" : "Hidden"}
                  {item.message.includes("{{") ? " · Placeholders fill in on the site" : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  disabled={togglingId === item.id}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${item.is_active ? "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white" : "bg-[#E4F56C] text-neutral-950"}`}
                >
                  {togglingId === item.id ? "Saving…" : item.is_active ? "Hide" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-[100000] flex justify-end">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => { setAddOpen(false); setEditItem(null); setNewMessage(""); }} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-5 dark:border-white/10 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-950 dark:text-white">{editItem ? "Edit announcement" : "Add announcement"}</h2>
                <p className="mt-1 text-sm text-neutral-500">Pick a template, then change the wording if you want.</p>
              </div>
              <button type="button" onClick={() => { setAddOpen(false); setEditItem(null); setNewMessage(""); }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-500">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <MessageEditor message={newMessage} onChange={setNewMessage} />
            </div>
            <div className="flex gap-2 border-t border-neutral-200 px-5 py-5 dark:border-white/10 sm:px-6">
              <button type="button" onClick={() => { setAddOpen(false); setEditItem(null); setNewMessage(""); }} className="flex-1 rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button type="button" onClick={editItem ? handleUpdate : handleAdd} disabled={saving || !newMessage.trim()} className="flex-1 rounded-full bg-[#E4F56C] py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50">
                {saving ? "Saving…" : editItem ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => setDeleteTarget(null)} />
          <div className={`${card} relative w-full max-w-md p-6`} onClick={(event) => event.stopPropagation()}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-red-500">Delete</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">Remove this announcement?</h2>
            <p className="mt-2 text-sm text-neutral-500">{deleteTarget.message}</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deletingId === deleteTarget.id} className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {deletingId === deleteTarget.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
