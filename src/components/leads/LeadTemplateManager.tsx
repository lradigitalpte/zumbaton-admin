"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { OutreachTemplate } from "./LeadSendComposer";

const blankForm = {
  name: "",
  channel: "email" as "email" | "whatsapp" | "both",
  emailSubject: "",
  emailBody: "",
  whatsappBody: "",
  isDefault: false,
};

export default function LeadTemplateManager() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ success: boolean; data: { templates: OutreachTemplate[] } }>("/api/leads/templates");
    if (res.error) showToast(res.error.message, "error");
    else setTemplates(res.data?.data.templates || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: OutreachTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      channel: t.channel as typeof form.channel,
      emailSubject: t.emailSubject,
      emailBody: t.emailBody,
      whatsappBody: t.whatsappBody,
      isDefault: t.isDefault,
    });
  };

  const startCreate = () => {
    setEditingId("new");
    setForm(blankForm);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(blankForm);
  };

  const save = async () => {
    if (!form.name.trim()) return showToast("Template name is required", "error");
    setSaving(true);
    const res = editingId === "new"
      ? await api.post("/api/leads/templates", form)
      : await api.put(`/api/leads/templates/${editingId}`, form);
    setSaving(false);
    if (res.error) return showToast(res.error.message, "error");
    showToast(editingId === "new" ? "Template created" : "Template updated", "success");
    cancel();
    await load();
  };

  const remove = async (t: OutreachTemplate) => {
    if (t.isDefault) return showToast("Cannot delete the default template", "error");
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const res = await api.delete(`/api/leads/templates/${t.id}`);
    if (res.error) return showToast(res.error.message, "error");
    showToast("Template deleted", "success");
    if (editingId === t.id) cancel();
    await load();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Message templates</h2>
          <p className="mt-1 text-sm text-gray-500">Saved templates used when composing follow-ups. Use {"{{name}}"} and {"{{first_name}}"} for personalization.</p>
        </div>
        <button onClick={startCreate} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">
          + New template
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading templates…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Channel</th>
                <th className="py-2">Subject</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 font-medium">
                    {t.name}
                    {t.isDefault && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Default</span>}
                  </td>
                  <td className="py-3 capitalize">{t.channel}</td>
                  <td className="max-w-xs truncate py-3 text-gray-500">{t.emailSubject || "—"}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => startEdit(t)} className="mr-2 text-xs font-semibold text-indigo-600">Edit</button>
                    {!t.isDefault && <button onClick={() => remove(t)} className="text-xs font-semibold text-red-600">Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingId && (
        <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{editingId === "new" ? "New template" : "Edit template"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
            </label>
            <label>
              <span className="text-sm font-medium">Channel</span>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700">
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              <span className="text-sm">Set as default</span>
            </label>
            {(form.channel === "email" || form.channel === "both") && (
              <>
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium">Email subject</span>
                  <input value={form.emailSubject} onChange={(e) => setForm({ ...form, emailSubject: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium">Email body</span>
                  <textarea rows={5} value={form.emailBody} onChange={(e) => setForm({ ...form, emailBody: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                </label>
              </>
            )}
            {(form.channel === "whatsapp" || form.channel === "both") && (
              <label className="sm:col-span-2">
                <span className="text-sm font-medium">WhatsApp note</span>
                <textarea rows={3} value={form.whatsappBody} onChange={(e) => setForm({ ...form, whatsappBody: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
              </label>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={cancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button disabled={saving} onClick={save} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
