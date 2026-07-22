"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import LeadSendComposer from "@/components/leads/LeadSendComposer";
import LeadSelectionBar from "@/components/leads/LeadSelectionBar";
import LeadTemplateManager from "@/components/leads/LeadTemplateManager";
import LeadWhatsAppManual from "@/components/leads/LeadWhatsAppManual";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

type Campaign = {
  id: string;
  name: string;
  channels: string[];
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  completed_at: string | null;
};

type CampaignMessage = {
  id: string;
  lead_name: string;
  channel: string;
  recipient: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
};

type PreviewLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  campaign: string;
  submittedAt: string;
  canEmail: boolean;
  canWhatsApp: boolean;
};

type PreviewCounts = {
  total: number;
  withPhone: number;
  withEmail: number;
  uniquePhones: number;
  uniqueEmails: number;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const statusClass: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-emerald-100 text-emerald-700",
  delivered: "bg-teal-100 text-teal-700",
  skipped: "bg-slate-100 text-slate-600",
  new: "bg-blue-100 text-blue-700",
  attempted_contact: "bg-orange-100 text-orange-700",
  contacted: "bg-amber-100 text-amber-700",
  follow_up: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
};

async function downloadExport(endpoint: string, filename: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || "Export failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type MarketingTab = "leads" | "templates" | "campaigns";

const marketingTabs: { value: MarketingTab; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "templates", label: "Templates" },
  { value: "campaigns", label: "Campaigns" },
];

export default function LeadMarketingPage() {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; message: string } | null>(null);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [visibility, setVisibility] = useState("active");
  const [search, setSearch] = useState("");

  const [previewLeads, setPreviewLeads] = useState<PreviewLead[]>([]);
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewTotal, setPreviewTotal] = useState(0);
  const pageSize = 25;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionSummary, setSelectionSummary] = useState({ email: 0, whatsapp: 0 });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerLeadIds, setComposerLeadIds] = useState<string[]>([]);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappLeadIds, setWhatsappLeadIds] = useState<string[]>([]);
  const [whatsappLeads, setWhatsappLeads] = useState<{ id: string; name: string; phone: string }[] | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<MarketingTab>("leads");

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (channel !== "all") params.set("channel", channel);
    if (status !== "all") params.set("status", status);
    if (hasEmail) params.set("hasEmail", "true");
    if (hasPhone) params.set("hasPhone", "true");
    if (visibility !== "active") params.set("visibility", visibility);
    if (search.trim()) params.set("search", search.trim());
    return params;
  }, [channel, status, hasEmail, hasPhone, visibility, search]);

  const filtersRecord = useCallback(() => {
    const record: Record<string, string> = {};
    if (channel !== "all") record.channel = channel;
    if (status !== "all") record.status = status;
    if (hasEmail) record.hasEmail = "true";
    if (hasPhone) record.hasPhone = "true";
    if (visibility !== "active") record.visibility = visibility;
    if (search.trim()) record.search = search.trim();
    return record;
  }, [channel, status, hasEmail, hasPhone, visibility, search]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{
      success: boolean;
      data: {
        campaigns: Campaign[];
        email: { configured: boolean; message: string };
      };
    }>("/api/leads/outreach");
    if (res.error) {
      setCampaignsError(res.error.message);
      setCampaigns([]);
    } else {
      setCampaignsError(null);
      setCampaigns(res.data?.data.campaigns || []);
      setEmailStatus(res.data?.data.email || null);
    }
    setLoading(false);
  }, []);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    const params = filterParams();
    params.set("page", String(previewPage));
    params.set("pageSize", String(pageSize));
    const res = await api.get<{
      success: boolean;
      data: {
        leads: PreviewLead[];
        counts: PreviewCounts;
        pageCount: number;
        totalMatching: number;
      };
    }>(`/api/leads/export/preview?${params}`);
    if (res.error) {
      setPreviewError(res.error.message);
      setPreviewLeads([]);
      setPreviewCounts(null);
    } else {
      setPreviewError(null);
      setPreviewLeads(res.data?.data.leads || []);
      setPreviewCounts(res.data?.data.counts || null);
      setPreviewPageCount(res.data?.data.pageCount || 1);
      setPreviewTotal(res.data?.data.totalMatching || 0);
    }
    setPreviewLoading(false);
  }, [filterParams, previewPage]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  useEffect(() => {
    setPreviewPage(1);
    setSelected(new Set());
  }, [channel, status, hasEmail, hasPhone, visibility, search]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!selected.size) {
      setSelectionSummary({ email: 0, whatsapp: 0 });
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    const items = [...selected].map((id) => ({ id, kind: "marketing" as const }));
    api.post<{ success: boolean; data: { eligibleEmail: number; eligibleWhatsApp: number } }>(
      "/api/leads/outreach/resolve",
      { items }
    ).then((res) => {
      if (cancelled) return;
      if (res.data?.data) {
        setSelectionSummary({
          email: res.data.data.eligibleEmail,
          whatsapp: res.data.data.eligibleWhatsApp,
        });
      }
      setSummaryLoading(false);
    });
    return () => { cancelled = true; };
  }, [selected]);

  const toggleLead = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      const allOnPage = previewLeads.every((l) => next.has(l.id));
      previewLeads.forEach((l) => (allOnPage ? next.delete(l.id) : next.add(l.id)));
      return next;
    });
  };

  const selectAllMatching = async () => {
    setSelectingAll(true);
    const res = await api.post<{ success: boolean; data: { leadIds: string[] } }>(
      "/api/leads/outreach/resolve",
      { useFilters: true, filters: filtersRecord() }
    );
    setSelectingAll(false);
    if (res.error) return showToast(res.error.message, "error");
    const ids = res.data?.data.leadIds || [];
    if (!ids.length) return showToast("No leads match these filters", "error");
    setSelected(new Set(ids));
    showToast(`Selected ${ids.length} matching leads`, "success");
  };

  const openComposer = (leadIds: string[]) => {
    if (!leadIds.length) return showToast("Select at least one lead", "error");
    setComposerLeadIds(leadIds);
    setComposerOpen(true);
  };

  const openWhatsApp = (leadIds: string[], leads?: { id: string; name: string; phone: string }[]) => {
    if (!leadIds.length && !leads?.length) return showToast("Select at least one lead", "error");
    setWhatsappLeadIds(leadIds);
    setWhatsappLeads(leads);
    setWhatsappOpen(true);
  };

  const runExport = async (format: "phones" | "emails" | "full") => {
    setExporting(format);
    try {
      const qs = filterParams().toString();
      const endpoint = `/api/leads/export?format=${format}${qs ? `&${qs}` : ""}`;
      const filename = `leads-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
      await downloadExport(endpoint, filename);
      showToast(`${format} export downloaded`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Export failed", "error");
    }
    setExporting(null);
  };

  const openCampaign = async (id: string) => {
    setActiveCampaign(id);
    setDetailLoading(true);
    const res = await api.get<{ success: boolean; data: { messages: CampaignMessage[] } }>(`/api/leads/outreach/${id}`);
    setMessages(res.data?.data.messages || []);
    setDetailLoading(false);
  };

  const pageAllSelected = previewLeads.length > 0 && previewLeads.every((l) => selected.has(l.id));

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Lead Marketing" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">Segment leads, select recipients, compose from templates, then review and send.</p>
        </div>
        <Link href="/leads" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">← Back to Leads CRM</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {marketingTabs.map((tab) => {
          const count =
            tab.value === "leads"
              ? previewTotal
              : tab.value === "campaigns"
                ? campaigns.length
                : null;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.value
                  ? "bg-indigo-600 text-white shadow-md"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
              {count !== null && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.value ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(campaignsError || previewError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Database migration required</p>
          <p className="mt-1">
            {campaignsError || previewError} — run{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">20260723_lead_outreach_templates.sql</code>{" "}
            in the Supabase SQL editor, then refresh this page.
          </p>
        </div>
      )}

      {activeTab === "leads" && (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or campaign" className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Source</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700">
              <option value="all">All sources</option>
              <option value="meta">Meta (FB + IG)</option>
              <option value="tiktok">TikTok</option>
              <option value="website">Website</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700">
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="attempted_contact">Attempted contact</option>
              <option value="contacted">Contacted</option>
              <option value="follow_up">Follow-up</option>
              <option value="converted">Converted</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Visibility</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700">
              <option value="active">Active only</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="flex flex-col justify-end gap-2">
            <span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} /> Has email</span>
            <span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} /> Has phone</span>
          </label>
        </div>

        {previewCounts && (
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {[
              ["Matching", previewCounts.total],
              ["With phone", previewCounts.withPhone],
              ["With email", previewCounts.withEmail],
              ["Unique phones", previewCounts.uniquePhones],
              ["Unique emails", previewCounts.uniqueEmails],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                <div className="text-[10px] font-bold uppercase text-gray-400">{label}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={togglePage} className="rounded-lg border px-3 py-1.5 text-sm" disabled={!previewLeads.length}>
            {pageAllSelected ? "Deselect page" : "Select page"}
          </button>
          <button
            onClick={selectAllMatching}
            disabled={selectingAll || !previewTotal}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {selectingAll ? "Selecting…" : `Select all ${previewTotal} matching`}
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-sm text-red-600">
              Clear selection
            </button>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          {previewLoading ? (
            <p className="p-8 text-center text-sm text-gray-500">Loading preview…</p>
          ) : !previewLeads.length ? (
            <p className="p-8 text-center text-sm text-gray-500">No leads match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/40">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select page"
                        checked={pageAllSelected}
                        onChange={togglePage}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Eligible</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {previewLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={selected.has(lead.id) ? "bg-indigo-50/80 dark:bg-indigo-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.name}`}
                          checked={selected.has(lead.id)}
                          onChange={() => toggleLead(lead.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lead.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.phone || <span className="text-gray-400">No phone</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.email || <span className="text-gray-400">No email</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 text-xs">
                          <span title={lead.canEmail ? "Can email" : "No email"} className={lead.canEmail ? "text-emerald-600" : "text-gray-300"}>✉</span>
                          <span title={lead.canWhatsApp ? "Can WhatsApp" : "No phone"} className={lead.canWhatsApp ? "text-emerald-600" : "text-gray-300"}>💬</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase">{lead.source}</span></td>
                      <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${statusClass[lead.status] || "bg-gray-100"}`}>{lead.status.replaceAll("_", " ")}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            disabled={!lead.canEmail || !emailStatus?.configured}
                            onClick={() => openComposer([lead.id])}
                            className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-40"
                          >
                            Email
                          </button>
                          <button
                            disabled={!lead.canWhatsApp}
                            onClick={() => openWhatsApp([lead.id], [{ id: lead.id, name: lead.name, phone: lead.phone }])}
                            className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-40"
                          >
                            WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!previewLoading && previewTotal > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(previewPage - 1) * pageSize + 1}–{Math.min(previewPage * pageSize, previewTotal)} of {previewTotal}</span>
            <div className="flex gap-2">
              <button disabled={previewPage === 1} onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button>
              <span>Page {previewPage} of {previewPageCount}</span>
              <button disabled={previewPage >= previewPageCount} onClick={() => setPreviewPage((p) => p + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">
          <button disabled={!!exporting || !previewCounts?.uniquePhones} onClick={() => runExport("phones")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {exporting === "phones" ? "Exporting…" : `Export phones (${previewCounts?.uniquePhones || 0})`}
          </button>
          <button disabled={!!exporting || !previewCounts?.uniqueEmails} onClick={() => runExport("emails")} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {exporting === "emails" ? "Exporting…" : `Export emails (${previewCounts?.uniqueEmails || 0})`}
          </button>
          <button disabled={!!exporting || !previewCounts?.total} onClick={() => runExport("full")} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {exporting === "full" ? "Exporting…" : `Export full CSV (${previewCounts?.total || 0})`}
          </button>
        </div>

        <LeadSelectionBar
          selectedCount={selected.size}
          eligibleEmail={selectionSummary.email}
          withPhone={selectionSummary.whatsapp}
          loading={summaryLoading}
          onClear={() => setSelected(new Set())}
          onCompose={() => openComposer([...selected])}
          onWhatsApp={() => openWhatsApp([...selected])}
        />
      </div>
      )}

      {activeTab === "templates" && <LeadTemplateManager />}

      {activeTab === "campaigns" && (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Follow-up campaigns</h2>
          <button onClick={loadCampaigns} className="text-sm text-indigo-600">Refresh</button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Loading campaigns…</p>
        ) : !campaigns.length ? (
          <p className="mt-4 text-sm text-gray-500">No campaigns yet. Select leads on the Leads tab and use Compose email to start a follow-up.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-gray-400">
                <tr>
                  <th className="py-2">Campaign</th>
                  <th className="py-2">Channels</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Sent</th>
                  <th className="py-2">Failed</th>
                  <th className="py-2">Skipped</th>
                  <th className="py-2">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3">{c.channels?.join(", ") || "—"}</td>
                    <td className="py-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${statusClass[c.status] || ""}`}>{c.status}</span></td>
                    <td className="py-3">{c.sent_count}/{c.total_count}</td>
                    <td className="py-3">{c.failed_count}</td>
                    <td className="py-3">{c.skipped_count}</td>
                    <td className="py-3 text-xs text-gray-500">{fmt(c.created_at)}</td>
                    <td className="py-3"><button onClick={() => openCampaign(c.id)} className="text-xs font-semibold text-indigo-600">View delivery</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {composerOpen && (
        <LeadSendComposer
          leadIds={composerLeadIds}
          emailConfigured={emailStatus?.configured ?? false}
          onClose={() => setComposerOpen(false)}
          onSent={() => {
            setSelected(new Set());
            loadCampaigns();
            setActiveTab("campaigns");
            showToast("Campaign queued successfully", "success");
          }}
        />
      )}

      {whatsappOpen && (
        <LeadWhatsAppManual
          leadIds={whatsappLeadIds}
          leads={whatsappLeads}
          onClose={() => {
            setWhatsappOpen(false);
            setWhatsappLeads(undefined);
          }}
        />
      )}

      {activeCampaign && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <button aria-label="Close" className="fixed inset-0 bg-gray-950/55" onClick={() => setActiveCampaign(null)} />
          <section className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <header className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Delivery log</h3>
              <button onClick={() => setActiveCampaign(null)} className="text-2xl text-gray-400">×</button>
            </header>
            {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-gray-400">
                  <tr>
                    <th className="py-2">Lead</th>
                    <th className="py-2">Channel</th>
                    <th className="py-2">Recipient</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Sent</th>
                    <th className="py-2">Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2">{m.lead_name}</td>
                      <td className="py-2 capitalize">{m.channel}</td>
                      <td className="py-2 text-xs">{m.recipient || "—"}</td>
                      <td className="py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass[m.status] || ""}`}>{m.status}</span>
                        {m.error_message && <div className="text-xs text-red-600">{m.error_message}</div>}
                      </td>
                      <td className="py-2 text-xs">{fmt(m.sent_at)}</td>
                      <td className="py-2 text-xs">{fmt(m.delivered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
