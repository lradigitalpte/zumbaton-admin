"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { renderTemplate } from "@/lib/lead-outreach-templates";

export type OutreachTemplate = {
  id: string;
  name: string;
  channel: string;
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
  isDefault: boolean;
};

export type SampleLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  canEmail: boolean;
  canWhatsApp: boolean;
};

type ResolveData = {
  total: number;
  eligibleEmail: number;
  skippedNoEmail: number;
  sampleLeads: SampleLead[];
  leadIds: string[];
};

type Props = {
  leadIds: string[];
  onClose: () => void;
  onSent: () => void;
  emailConfigured?: boolean;
};

export default function LeadSendComposer({
  leadIds,
  onClose,
  onSent,
  emailConfigured = true,
}: Props) {
  const [step, setStep] = useState<"compose" | "review">("compose");
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [resolve, setResolve] = useState<ResolveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [templateId, setTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [previewLeadId, setPreviewLeadId] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const items = useMemo(
    () => leadIds.map((id) => ({ id, kind: "marketing" as const })),
    [leadIds]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [templatesRes, resolveRes] = await Promise.all([
      api.get<{ success: boolean; data: { templates: OutreachTemplate[] } }>("/api/leads/templates"),
      api.post<{ success: boolean; data: ResolveData }>("/api/leads/outreach/resolve", { items }),
    ]);

    if (templatesRes.error) setError(templatesRes.error.message);
    else {
      const list = templatesRes.data?.data.templates || [];
      setTemplates(list);
      const def = list.find((t) => t.isDefault) || list[0];
      if (def) {
        setTemplateId(def.id);
        setEmailSubject(def.emailSubject);
        setEmailBody(def.emailBody);
      }
    }

    if (resolveRes.error) setError(resolveRes.error.message);
    else {
      const data = resolveRes.data?.data || null;
      setResolve(data);
      if (data?.sampleLeads[0]) setPreviewLeadId(data.sampleLeads[0].id);
    }
    setLoading(false);
  }, [items]);

  useEffect(() => { load(); }, [load]);

  const previewLead = resolve?.sampleLeads.find((l) => l.id === previewLeadId) || resolve?.sampleLeads[0];

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setEmailSubject(t.emailSubject);
    setEmailBody(t.emailBody);
  };

  const previewSubject = previewLead ? renderTemplate(emailSubject, { name: previewLead.name }) : emailSubject;
  const previewBody = previewLead ? renderTemplate(emailBody, { name: previewLead.name }) : emailBody;

  const goReview = () => {
    if (!emailConfigured) return setError("Email is not configured");
    setError("");
    setStep("review");
  };

  const send = async () => {
    if (!resolve) return;
    setSending(true);
    setError("");

    if (saveAsTemplate && newTemplateName.trim()) {
      await api.post("/api/leads/templates", {
        name: newTemplateName.trim(),
        channel: "email",
        emailSubject,
        emailBody,
        whatsappBody: "",
      });
    }

    const res = await api.post<{ success: boolean; data: { queued: number; skipped: number } }>("/api/leads/outreach", {
      items,
      channels: ["email"],
      templateId: templateId || undefined,
      emailSubject,
      emailBody,
      name: campaignName || undefined,
    });

    setSending(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSent();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
      <button aria-label="Close" className="fixed inset-0 bg-gray-950/55" onClick={onClose} />
      <section className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Compose email</h3>
            <p className="mt-1 text-sm text-gray-500">
              {resolve?.total || leadIds.length} recipient{leadIds.length === 1 ? "" : "s"} selected
              {step === "review" ? " · Review before sending" : " · Step 1 of 2"}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
        </header>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {step === "compose" && (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Template</span>
                  <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700">
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Campaign name (optional)</span>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. TikTok new leads March" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Email subject</span>
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Email body</span>
                  <span className="ml-2 text-xs text-gray-400">{"{{name}}"} and {"{{first_name}}"} personalize each send</span>
                  <textarea rows={7} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                </label>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-indigo-600">Live preview</span>
                    {resolve && resolve.sampleLeads.length > 1 && (
                      <select value={previewLeadId} onChange={(e) => setPreviewLeadId(e.target.value)} className="rounded border px-2 py-1 text-xs dark:bg-gray-700">
                        {resolve.sampleLeads.map((l) => (
                          <option key={l.id} value={l.id}>Preview as {l.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Subject</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{previewSubject}</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{previewBody}</div>
                  <p className="mt-3 text-xs text-indigo-700/80 dark:text-indigo-300/80">
                    Recipients receive this message inside a branded One Step Fitness email with your logo, trial booking button, phone, and WhatsApp contact details.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                  Save edits as new template
                </label>
                {saveAsTemplate && (
                  <input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
                )}

                <div className="flex justify-end gap-2 border-t pt-4">
                  <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                  <button disabled={!emailConfigured} onClick={goReview} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Review & send</button>
                </div>
              </div>
            )}

            {step === "review" && resolve && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Send summary</h4>
                  <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li>{resolve.total} leads selected</li>
                    <li>{resolve.eligibleEmail} will receive email{resolve.skippedNoEmail ? ` · ${resolve.skippedNoEmail} skipped (no email)` : ""}</li>
                    <li>Each person gets their own name in {"{{name}}"} / {"{{first_name}}"}</li>
                    <li>Messages queue in batches (~25 every 2 min)</li>
                  </ul>
                </div>

                <div className="flex justify-between gap-2 border-t pt-4">
                  <button onClick={() => setStep("compose")} className="rounded-lg border px-4 py-2 text-sm">Back</button>
                  <button disabled={sending} onClick={send} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {sending ? "Queueing…" : "Confirm & send"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
