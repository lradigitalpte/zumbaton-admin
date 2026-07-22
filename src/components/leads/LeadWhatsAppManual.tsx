"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { DEFAULT_WHATSAPP_BODY, renderTemplate } from "@/lib/lead-outreach-templates";
import { waMeUrl } from "@/lib/lead-whatsapp-manual";
import type { OutreachTemplate } from "./LeadSendComposer";

export type WhatsAppLead = {
  id: string;
  name: string;
  phone: string;
};

type Props = {
  leadIds?: string[];
  leads?: WhatsAppLead[];
  onClose: () => void;
};

export default function LeadWhatsAppManual({ leadIds, leads: initialLeads, onClose }: Props) {
  const [loading, setLoading] = useState(!initialLeads?.length);
  const [recipients, setRecipients] = useState<WhatsAppLead[]>(initialLeads || []);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_WHATSAPP_BODY);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const templatesRes = await api.get<{ success: boolean; data: { templates: OutreachTemplate[] } }>("/api/leads/templates");
    if (templatesRes.data?.data.templates) {
      const list = templatesRes.data.data.templates;
      setTemplates(list);
      const def = list.find((t) => t.isDefault) || list[0];
      if (def?.whatsappBody) setMessageTemplate(def.whatsappBody);
      else if (def?.emailBody) setMessageTemplate(def.emailBody);
    }

    if (initialLeads?.length) {
      setRecipients(initialLeads.filter((l) => l.phone));
      if (!initialLeads.some((l) => l.phone)) setError("This lead has no phone number.");
      setLoading(false);
      return;
    }
    if (!leadIds?.length) {
      setError("No leads selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const items = leadIds.map((id) => ({ id, kind: "marketing" as const }));
    const resolveRes = await api.post<{
      success: boolean;
      data: { recipients: Array<{ id: string; name: string; phone: string; canWhatsApp: boolean }> };
    }>("/api/leads/outreach/resolve", { items });

    if (resolveRes.error) {
      setError(resolveRes.error.message);
    } else {
      const rows = (resolveRes.data?.data.recipients || [])
        .filter((l) => l.canWhatsApp && l.phone)
        .map((l) => ({ id: l.id, name: l.name, phone: l.phone }));
      setRecipients(rows);
      if (!rows.length) setError("None of the selected leads have a phone number.");
    }
    setLoading(false);
  }, [initialLeads, leadIds]);

  useEffect(() => { load(); }, [load]);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMessageTemplate(t.whatsappBody || t.emailBody || DEFAULT_WHATSAPP_BODY);
  };

  const personalized = useMemo(
    () =>
      recipients.map((lead) => ({
        ...lead,
        message: renderTemplate(messageTemplate, { name: lead.name }),
        url: waMeUrl(lead.phone, renderTemplate(messageTemplate, { name: lead.name })),
      })),
    [recipients, messageTemplate]
  );

  const copyMessage = async (leadId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(leadId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
      <button aria-label="Close" className="fixed inset-0 bg-gray-950/55" onClick={onClose} />
      <section className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <header className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">WhatsApp — send manually</h3>
              <p className="mt-1 text-sm text-gray-500">
                Open each chat from your phone or WhatsApp Web. Messages are not sent automatically.
              </p>
            </div>
            <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {error && !personalized.length && (
                <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
              )}

              {templates.length > 0 && (
                <label className="mb-4 block">
                  <span className="text-sm font-medium">Message template</span>
                  <select
                    onChange={(e) => applyTemplate(e.target.value)}
                    defaultValue=""
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700"
                  >
                    <option value="" disabled>Choose a saved template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="mb-4 block">
                <span className="text-sm font-medium">Message</span>
                <span className="ml-2 text-xs text-gray-400">{"{{name}}"} and {"{{first_name}}"} personalize per lead</span>
                <textarea
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700"
                />
              </label>

              {personalized.length > 0 && (
                <ul className="space-y-3">
                  {personalized.map((lead) => (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{lead.name}</div>
                          <div className="text-sm text-gray-500">{lead.phone}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyMessage(lead.id, lead.message)}
                            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          >
                            {copiedId === lead.id ? "Copied" : "Copy message"}
                          </button>
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Open WhatsApp
                          </a>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                        {lead.message}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-gray-100 px-6 py-4 text-right dark:border-gray-700">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Done</button>
        </footer>
      </section>
    </div>
  );
}
