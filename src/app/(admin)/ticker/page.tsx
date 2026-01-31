"use client";

import { useState, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/button/Button";
import { SlidePanel } from "@/components/SlidePanel";

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

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Ticker" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Header Ticker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Announcements appear in the scrolling ticker on the website. Only active items are shown. Pick a template when adding a message, or write your own. Early Bird templates update automatically with current spots and discount.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditItem(null);
            setNewMessage("");
            setAddOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <span>Add announcement</span>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-8 text-center text-gray-500 dark:text-gray-400">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-8 text-center text-gray-500 dark:text-gray-400">
          No announcements yet. Add one to show in the header ticker.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-gray-700">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white font-medium truncate">{item.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.is_active ? (
                      <span className="text-green-600 dark:text-green-400">Active – shown on site</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Inactive – hidden</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingId === item.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      item.is_active
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                    }`}
                  >
                    {togglingId === item.id ? "…" : item.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {deletingId === item.id ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add announcement – slide panel */}
      <SlidePanel
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add announcement"
        size="md"
        position="right"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Use a template</p>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setNewMessage(tpl.message)}
                  className="rounded-lg px-3 py-2 text-left text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors max-w-full"
                >
                  <span className="font-medium text-gray-900 dark:text-white block">{tpl.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{tpl.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message (edit if needed)</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Or type your own message…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/30 focus:border-green-500 dark:focus:ring-green-500/20 dark:focus:border-green-500 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </SlidePanel>

      {/* Edit announcement – slide panel */}
      <SlidePanel
        isOpen={!!editItem}
        onClose={() => { setEditItem(null); setNewMessage(""); }}
        title="Edit announcement"
        size="md"
        position="right"
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditItem(null); setNewMessage(""); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Use a template</p>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setNewMessage(tpl.message)}
                  className="rounded-lg px-3 py-2 text-left text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors max-w-full"
                >
                  <span className="font-medium text-gray-900 dark:text-white block">{tpl.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{tpl.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message (edit if needed)</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/30 focus:border-green-500 dark:focus:ring-green-500/20 dark:focus:border-green-500 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
