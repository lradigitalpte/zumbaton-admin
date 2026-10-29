"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { OutreachTemplate } from "./LeadSendComposer";

const field = "mt-1.5 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";
const area = "mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";

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

  const channelTone = (channel: string) =>
    channel === "both"
      ? "bg-neutral-950 text-[#E4F56C]"
      : channel === "email"
        ? "bg-[#E4F56C] text-neutral-950"
        : "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white";
  const preview = form.channel === "whatsapp" ? form.whatsappBody : form.emailBody;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Message templates</h2>
          <p className="mt-1 text-sm text-neutral-500">Saved templates used when composing follow-ups. Use {"{{name}}"} and {"{{first_name}}"} for personalization.</p>
        </div>
        <button onClick={startCreate} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]">
          New template
        </button>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-12 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-gray-800">Loading templates…</div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const body = (t.channel === "whatsapp" ? t.whatsappBody : t.emailBody) || "";
            return (
              <article
                key={t.id}
                className={`rounded-[28px] border bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:bg-gray-800 ${
                  t.isDefault ? "border-[#d5e45c]" : "border-neutral-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                      {(t.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${channelTone(t.channel)}`}>{t.channel}</span>
                        {t.isDefault && <span className="rounded-full bg-[#E4F56C] px-2.5 py-1 text-[11px] font-semibold text-neutral-950">Default</span>}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{t.name}</h3>
                      <p className="truncate text-sm text-neutral-500">{t.emailSubject || "No subject"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => startEdit(t)} className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white">Edit</button>
                    {!t.isDefault && <button onClick={() => remove(t)} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Delete</button>}
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 rounded-[22px] bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600 dark:bg-white/5 dark:text-white/70">
                  {body || "No message written yet."}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <button aria-label="Close" className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={cancel} />
          <section className="relative max-h-[90vh] w-[min(980px,calc(100vw-2rem))] overflow-y-auto rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-gray-800">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{editingId === "new" ? "New template" : "Edit template"}</h3>
                <p className="mt-1 text-sm text-neutral-500">{"{{name}}"} and {"{{first_name}}"} are filled in for each lead.</p>
              </div>
              <button onClick={cancel} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-lg text-white">×</button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
                </label>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Channel</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["email", "whatsapp", "both"] as const).map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setForm({ ...form, channel })}
                        className={`rounded-full px-3.5 py-2 text-xs font-semibold capitalize ${form.channel === channel ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"}`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isDefault: !form.isDefault })}
                  className={`flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left ${form.isDefault ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-50 text-neutral-700 dark:bg-white/5 dark:text-white"}`}
                >
                  <span className="text-sm font-semibold">Use as the default template</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${form.isDefault ? "bg-neutral-950 text-[#E4F56C]" : "bg-white text-neutral-500"}`}>{form.isDefault ? "On" : "Off"}</span>
                </button>
                {(form.channel === "email" || form.channel === "both") && (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Email subject</span>
                      <input value={form.emailSubject} onChange={(e) => setForm({ ...form, emailSubject: e.target.value })} className={field} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Email body</span>
                      <textarea rows={8} value={form.emailBody} onChange={(e) => setForm({ ...form, emailBody: e.target.value })} className={area} />
                    </label>
                  </>
                )}
                {(form.channel === "whatsapp" || form.channel === "both") && (
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">WhatsApp note</span>
                    <textarea rows={4} value={form.whatsappBody} onChange={(e) => setForm({ ...form, whatsappBody: e.target.value })} className={area} />
                  </label>
                )}
              </div>
              <div className="rounded-[22px] bg-neutral-950 p-5 text-white lg:sticky lg:top-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">Preview</p>
                <p className="mt-3 text-lg font-semibold">{form.emailSubject || "Subject appears here"}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{preview || "The message will show here as you write."}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={cancel} className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950">Cancel</button>
              <button disabled={saving} onClick={save} className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
