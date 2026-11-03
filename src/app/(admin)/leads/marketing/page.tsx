"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LeadSendComposer from "@/components/leads/LeadSendComposer";
import StudioMenu from "@/components/ui/StudioMenu";
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
  opened_count?: number;
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
  opened_at: string | null;
  clicked_at: string | null;
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
  queued: "bg-neutral-100 text-neutral-700",
  processing: "bg-neutral-950 text-[#E4F56C]",
  completed: "bg-neutral-950 text-white",
  failed: "bg-red-50 text-red-600",
  pending: "bg-neutral-100 text-neutral-500",
  sent: "bg-[#E4F56C] text-neutral-950",
  delivered: "bg-[#E4F56C]/70 text-neutral-950",
  opened: "bg-neutral-800 text-white",
  clicked: "bg-neutral-950 text-white",
  skipped: "bg-neutral-100 text-neutral-500",
  new: "bg-[#E4F56C] text-neutral-950",
  attempted_contact: "bg-neutral-100 text-neutral-700",
  contacted: "bg-neutral-200 text-neutral-950",
  follow_up: "bg-neutral-950 text-[#E4F56C]",
  converted: "bg-neutral-950 text-white",
};
const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";
const pillOn = "rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white";
const pillOff = "rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70";

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
  const [retryLoading, setRetryLoading] = useState<"failed" | "pending" | null>(null);

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
  const [campaignPage, setCampaignPage] = useState(1);
  const campaignPageSize = 8;

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

  const refreshActiveCampaign = async () => {
    if (!activeCampaign) return;
    const res = await api.get<{ success: boolean; data: { messages: CampaignMessage[] } }>(`/api/leads/outreach/${activeCampaign}`);
    setMessages(res.data?.data.messages || []);
    await loadCampaigns();
  };

  const retryCampaign = async (action: "failed" | "pending") => {
    if (!activeCampaign) return;
    setRetryLoading(action);
    const res = await api.post<{ success: boolean; data: { sent: number; processed: number; resetCount?: number }; error?: { message: string } }>(
      `/api/leads/outreach/${activeCampaign}/retry`,
      { action }
    );
    setRetryLoading(null);
    if (res.error) return showToast(res.error.message, "error");
    const data = res.data?.data;
    if (action === "failed") {
      showToast(`Retried ${data?.resetCount || 0} failed — sent ${data?.sent || 0} this batch`, "success");
    } else {
      showToast(`Processed ${data?.processed || 0} pending — sent ${data?.sent || 0}`, "success");
    }
    await refreshActiveCampaign();
  };

  const failedCount = messages.filter((m) => m.status === "failed").length;
  const pendingCount = messages.filter((m) => m.status === "pending" || m.status === "sending").length;

  const pageAllSelected = previewLeads.length > 0 && previewLeads.every((l) => selected.has(l.id));

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Lead Marketing</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">Segment leads, select recipients, compose from templates, then review and send.</p>
        </div>
        <Link href="/leads" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white">Back to Leads</Link>
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
              className={`inline-flex items-center gap-2 ${activeTab === tab.value ? pillOn : pillOff}`}
            >
              {tab.label}
              {count !== null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab.value ? "bg-[#E4F56C] text-neutral-950" : "bg-white text-neutral-500 dark:bg-neutral-950 dark:text-white/70"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(campaignsError || previewError) && (
        <div className="rounded-[22px] border border-[#d5e45c] bg-[#E4F56C]/40 px-4 py-3 text-sm text-neutral-950">
          <p className="font-semibold">Database migration required</p>
          <p className="mt-1">
            {campaignsError || previewError} — run{" "}
            <code className="rounded-full bg-neutral-950 px-2 py-0.5 text-xs text-[#E4F56C]">20260723_lead_outreach_templates.sql</code>{" "}
            in the Supabase SQL editor, then refresh this page.
          </p>
        </div>
      )}

      {activeTab === "leads" && (
      <div className={`${card} p-5`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or campaign" className={field} />
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Source</span>
            <StudioMenu value={channel} onChange={setChannel} placeholder="All sources" options={[{ value: "all", label: "All sources" }, { value: "meta", label: "Meta (FB + IG)" }, { value: "tiktok", label: "TikTok" }, { value: "website", label: "Website" }, { value: "manual", label: "Manual" }]} />
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Status</span>
            <StudioMenu value={status} onChange={setStatus} placeholder="All statuses" options={[{ value: "all", label: "All statuses" }, { value: "new", label: "New" }, { value: "attempted_contact", label: "Attempted contact" }, { value: "contacted", label: "Contacted" }, { value: "follow_up", label: "Follow-up" }, { value: "converted", label: "Converted" }]} />
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Visibility</span>
            <StudioMenu value={visibility} onChange={setVisibility} placeholder="Active only" options={[{ value: "active", label: "Active only" }, { value: "archived", label: "Archived" }, { value: "all", label: "All" }]} />
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
              <div key={label} className="rounded-[22px] bg-neutral-50 px-3 py-3 dark:bg-white/5">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">{label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={togglePage} className={pillOff} disabled={!previewLeads.length}>
            {pageAllSelected ? "Deselect page" : "Select page"}
          </button>
          <button
            onClick={selectAllMatching}
            disabled={selectingAll || !previewTotal}
            className={`${pillOn} disabled:opacity-50`}
          >
            {selectingAll ? "Selecting…" : `Select all ${previewTotal} matching`}
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="rounded-full px-3.5 py-2 text-xs font-semibold text-red-600">
              Clear selection
            </button>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-neutral-200/80 dark:border-white/10">
          {previewLoading ? (
            <p className="p-8 text-center text-sm text-neutral-500">Loading preview…</p>
          ) : !previewLeads.length ? (
            <p className="p-8 text-center text-sm text-neutral-500">No leads match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select page"
                        checked={pageAllSelected}
                        onChange={togglePage}
                        className="h-4 w-4 accent-neutral-950"
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
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {previewLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={selected.has(lead.id) ? "bg-[#E4F56C]/25" : "hover:bg-neutral-50 dark:hover:bg-white/5"}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.name}`}
                          checked={selected.has(lead.id)}
                          onChange={() => toggleLead(lead.id)}
                          className="h-4 w-4 accent-neutral-950"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{lead.name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600">{lead.phone || <span className="text-neutral-400">No phone</span>}</td>
                      <td className="px-4 py-3 text-neutral-600">{lead.email || <span className="text-neutral-400">No email</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 text-[11px] font-semibold">
                          <span title={lead.canEmail ? "Can email" : "No email"} className={`rounded-full px-2 py-0.5 ${lead.canEmail ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-400"}`}>Email</span>
                          <span title={lead.canWhatsApp ? "Can WhatsApp" : "No phone"} className={`rounded-full px-2 py-0.5 ${lead.canWhatsApp ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-400"}`}>WA</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase text-neutral-700 dark:bg-white/10 dark:text-white">{lead.source}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass[lead.status] || "bg-neutral-100"}`}>{lead.status.replaceAll("_", " ")}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            disabled={!lead.canEmail || !emailStatus?.configured}
                            onClick={() => openComposer([lead.id])}
                            className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                          >
                            Email
                          </button>
                          <button
                            disabled={!lead.canWhatsApp}
                            onClick={() => openWhatsApp([lead.id], [{ id: lead.id, name: lead.name, phone: lead.phone }])}
                            className="rounded-full bg-[#E4F56C] px-2.5 py-1 text-[11px] font-semibold text-neutral-950 disabled:opacity-40"
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
          <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
            <span>Showing {(previewPage - 1) * pageSize + 1}–{Math.min(previewPage * pageSize, previewTotal)} of {previewTotal}</span>
            <div className="flex items-center gap-2">
              <button disabled={previewPage === 1} onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} className="rounded-full border border-neutral-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
              <span className="font-medium text-neutral-950 dark:text-white">Page {previewPage} of {previewPageCount}</span>
              <button disabled={previewPage >= previewPageCount} onClick={() => setPreviewPage((p) => p + 1)} className="rounded-full border border-neutral-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-5 dark:border-white/10">
          <button disabled={!!exporting || !previewCounts?.uniquePhones} onClick={() => runExport("phones")} className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {exporting === "phones" ? "Exporting…" : `Export phones (${previewCounts?.uniquePhones || 0})`}
          </button>
          <button disabled={!!exporting || !previewCounts?.uniqueEmails} onClick={() => runExport("emails")} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50">
            {exporting === "emails" ? "Exporting…" : `Export emails (${previewCounts?.uniqueEmails || 0})`}
          </button>
          <button disabled={!!exporting || !previewCounts?.total} onClick={() => runExport("full")} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
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

      {activeTab === "campaigns" && (() => {
        const campaignPageCount = Math.max(1, Math.ceil(campaigns.length / campaignPageSize));
        const page = Math.min(campaignPage, campaignPageCount);
        const visibleCampaigns = campaigns.slice((page - 1) * campaignPageSize, page * campaignPageSize);
        return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Follow-up campaigns</h2>
            <p className="mt-1 text-sm text-neutral-500">Large sends go out slowly. Open a campaign to retry failed messages or send what is still pending.</p>
          </div>
          <button onClick={loadCampaigns} className={pillOff}>Refresh</button>
        </div>
        {loading ? (
          <div className={`${card} p-12 text-center text-sm text-neutral-500`}>Loading campaigns…</div>
        ) : !campaigns.length ? (
          <div className={`${card} p-12 text-center text-sm text-neutral-500`}>No campaigns yet. Select leads on the Leads tab and compose an email to start a follow-up.</div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleCampaigns.map((c) => {
                const sentPct = c.total_count > 0 ? Math.round((c.sent_count / c.total_count) * 100) : 0;
                const openPct = c.sent_count > 0 ? Math.round(((c.opened_count ?? 0) / c.sent_count) * 100) : 0;
                return (
                  <article key={c.id} className={`${card} p-5`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-neutral-700 dark:bg-white/10 dark:text-white">{c.channels?.join(", ") || "—"}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass[c.status] || "bg-neutral-100"}`}>{c.status}</span>
                          {c.failed_count > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">{c.failed_count} failed</span>}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{c.name}</h3>
                        <p className="text-sm text-neutral-500">{fmt(c.created_at)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[420px]">
                        <div className="rounded-2xl bg-neutral-50 px-3 py-2 dark:bg-white/5">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Sent</p>
                          <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{c.sent_count}<span className="text-sm font-medium text-neutral-400">/{c.total_count}</span></p>
                        </div>
                        <div className="rounded-2xl bg-[#E4F56C] px-3 py-2 text-neutral-950">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">Opened</p>
                          <p className="mt-1 text-lg font-semibold">{c.channels?.includes("email") ? `${openPct}%` : "—"}</p>
                        </div>
                        <div className="rounded-2xl bg-neutral-950 px-3 py-2 text-white">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">Failed</p>
                          <p className="mt-1 text-lg font-semibold">{c.failed_count}</p>
                        </div>
                        <div className="rounded-2xl bg-neutral-50 px-3 py-2 dark:bg-white/5">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Skipped</p>
                          <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{c.skipped_count}</p>
                        </div>
                      </div>
                      <button onClick={() => openCampaign(c.id)} className="shrink-0 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">View delivery</button>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-neutral-950 dark:bg-[#E4F56C]" style={{ width: `${sentPct}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
            <div className={`${card} flex flex-col items-center justify-between gap-3 px-5 py-4 text-sm sm:flex-row`}>
              <span className="text-neutral-500">Showing {(page - 1) * campaignPageSize + 1}–{Math.min(page * campaignPageSize, campaigns.length)} of {campaigns.length}</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setCampaignPage(page - 1)} className="rounded-full border border-neutral-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
                <span className="font-medium text-neutral-950 dark:text-white">Page {page} of {campaignPageCount}</span>
                <button disabled={page === campaignPageCount} onClick={() => setCampaignPage(page + 1)} className="rounded-full border border-neutral-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
        );
      })()}

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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <button aria-label="Close" className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveCampaign(null)} />
          <section className="relative max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-gray-800">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Delivery log</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Sends ~10 per batch, ~1.5s apart. Cron processes pending every 2 minutes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingCount > 0 && (
                  <button
                    type="button"
                    disabled={!!retryLoading}
                    onClick={() => retryCampaign("pending")}
                    className="rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
                  >
                    {retryLoading === "pending" ? "Sending…" : `Send pending now (${pendingCount})`}
                  </button>
                )}
                {failedCount > 0 && (
                  <button
                    type="button"
                    disabled={!!retryLoading}
                    onClick={() => retryCampaign("failed")}
                    className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {retryLoading === "failed" ? "Retrying…" : `Retry failed (${failedCount})`}
                  </button>
                )}
                <button onClick={() => setActiveCampaign(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-lg text-white">×</button>
              </div>
            </header>
            {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="py-2">Lead</th>
                    <th className="py-2">Channel</th>
                    <th className="py-2">Recipient</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Sent</th>
                    <th className="py-2">Delivered</th>
                    <th className="py-2">Opened</th>
                    <th className="py-2">Clicked</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2">{m.lead_name}</td>
                      <td className="py-2 capitalize">{m.channel}</td>
                      <td className="py-2 text-xs">{m.recipient || "—"}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[m.status] || "bg-neutral-100"}`}>{m.status}</span>
                        {m.error_message && <div className="text-xs text-red-600">{m.error_message}</div>}
                      </td>
                      <td className="py-2 text-xs">{fmt(m.sent_at)}</td>
                      <td className="py-2 text-xs">{fmt(m.delivered_at)}</td>
                      <td className="py-2 text-xs">{fmt(m.opened_at)}</td>
                      <td className="py-2 text-xs">{fmt(m.clicked_at)}</td>
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
