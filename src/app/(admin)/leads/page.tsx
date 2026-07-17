"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type LeadStatus = "new" | "attempted_contact" | "contacted" | "follow_up" | "trial_scheduled" | "trial_attended" | "converted" | "not_interested" | "unreachable" | "cold";
type LeadChannel = "all" | "meta" | "tiktok" | "website" | "manual" | "other";
type WorkQueue = "starred" | "needs_action" | "follow_up" | "active" | "converted" | "closed" | "all";
interface Lead {
  kind: "marketing" | "quick_join"; id: string; createdAt: string; submittedAt: string; importedAt: string; name: string; email: string; phone: string;
  source: string; platform: string; status: LeadStatus; archived: boolean; archivedAt: string; starred: boolean; starredAt: string; assignedTo: string; assignedName: string; nextFollowUpAt: string;
  lastContactedAt: string; notes: string; lostReason: string; campaignName: string; adsetName: string; adName: string;
  formName: string; externalId: string; importedFrom: string; rawFormData: Record<string, unknown>; paymentStatus: string; provider: string; promoLabel: string;
  chargedAmount: number; balance: number; bookedClassTitle: string; bookedClassAt: string;
}
interface Staff { id: string; name: string; role: string }
interface ClassOption { id: string; title: string; scheduledAt: string; capacity: number; bookedCount: number; location: string }

const STATUSES: LeadStatus[] = ["new", "attempted_contact", "contacted", "follow_up", "trial_scheduled", "trial_attended", "converted", "not_interested", "unreachable", "cold"];
const statusLabel = (s: LeadStatus) => s.replaceAll("_", " ");
const statusClass: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200", attempted_contact: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200", contacted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  follow_up: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200", trial_scheduled: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200", trial_attended: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200",
  converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200", not_interested: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-100", unreachable: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
  cold: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
};
const fmt = (iso: string) => iso ? new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const ageLabel = (iso: string) => { const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); return days === 0 ? "Today" : days === 1 ? "1 day waiting" : `${days} days waiting`; };
const dateInput = (iso: string) => iso ? new Date(iso).toISOString().slice(0, 16) : "";
const TECHNICAL_FORM_FIELDS = new Set([
  "id", "external_id", "created_time", "submitted_at", "ad_id", "ad_name", "adset_id", "adset_name",
  "campaign_id", "campaign_name", "form_id", "form_name", "is_organic", "platform", "source", "lead_status",
  "tiktok lead id", "tiktok lead status", "click id", "full_name", "name", "phone", "phone_number",
  "phone number", "number", "email",
]);
const formLabel = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}
const channelFor = (lead: Lead): Exclude<LeadChannel, "all"> => {
  if (["meta", "facebook", "instagram"].includes(lead.source)) return "meta";
  if (lead.source === "tiktok") return "tiktok";
  if (["website", "google_sheets"].includes(lead.source) || lead.kind === "quick_join") return "website";
  if (lead.source === "manual") return "manual";
  return "other";
};

function Modal({ title, onClose, children, wide = false, drawer = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; drawer?: boolean }) {
  const isDrawer = drawer || title === "Lead details";
  return <div className={`fixed inset-0 z-[999999] flex ${isDrawer ? "justify-end" : "items-center justify-center p-4"}`}><button aria-label="Close" className="fixed inset-0 bg-gray-950/55 backdrop-blur-[1px]" onClick={onClose} />
    <section className={`relative w-full bg-white shadow-2xl dark:bg-gray-800 ${isDrawer ? "h-dvh max-w-3xl overflow-y-auto border-l border-gray-200 dark:border-gray-700" : `max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${wide ? "max-w-3xl" : "max-w-xl"}`}`}>
      <header className={`${isDrawer ? "sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:px-8" : "mb-5"} flex items-center justify-between`}><div><h2 className={`${isDrawer ? "text-xl" : "text-lg"} font-bold text-gray-900 dark:text-white`}>{title}</h2>{isDrawer && <p className="mt-1 text-sm text-gray-500">Contact information, campaign attribution and form responses</p>}</div><button onClick={onClose} aria-label="Close details" className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-2xl leading-none text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:hover:bg-gray-700">×</button></header>
      <div className={isDrawer ? "px-6 py-6 sm:px-8 sm:py-8" : ""}>{children}</div>
    </section></div>;
}

const blankForm = { name: "", phone: "", email: "", source: "manual", status: "new" as LeadStatus, assignedTo: "", nextFollowUpAt: "", submittedAt: "", notes: "", lostReason: "" };

export default function LeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]); const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"all" | LeadStatus>("all"); const [channel, setChannel] = useState<LeadChannel>("all"); const [queue, setQueue] = useState<WorkQueue>("needs_action"); const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(25);
  const [visibility, setVisibility] = useState<"active" | "archived" | "all">("active"); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("contacted"); const [bulkAssignee, setBulkAssignee] = useState(""); const [bulkFollowUp, setBulkFollowUp] = useState("");
  const [active, setActive] = useState<Lead | null>(null); const [modal, setModal] = useState<"view" | "edit" | "add" | "book" | "import" | null>(null);
  const [form, setForm] = useState(blankForm); const [classes, setClasses] = useState<ClassOption[]>([]); const [classId, setClassId] = useState("");
  const [importFile, setImportFile] = useState(""); const [importRows, setImportRows] = useState<Record<string, string>[]>([]); const [importError, setImportError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); const res = await api.get<{ success: boolean; data: { leads: Lead[]; staff: Staff[] } }>("/api/leads");
    if (res.error) setError(res.error.message); else { setError(""); setLeads(res.data?.data.leads || []); setStaff(res.data?.data.staff || []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const queueMatch = (lead: Lead) => {
    if (queue === "starred") return lead.starred;
    if (queue === "needs_action") return ["new", "attempted_contact", "unreachable"].includes(lead.status);
    if (queue === "follow_up") return lead.status === "follow_up" || Boolean(lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date());
    if (queue === "active") return ["contacted", "trial_scheduled", "trial_attended"].includes(lead.status);
    if (queue === "converted") return lead.status === "converted";
    if (queue === "closed") return ["not_interested", "cold"].includes(lead.status);
    return true;
  };
  const allFiltered = useMemo(() => leads.filter((l) => {
    const q = search.trim().toLowerCase();
    const leadTime = new Date(l.createdAt).getTime();
    const afterStart = !dateFrom || leadTime >= new Date(`${dateFrom}T00:00:00`).getTime();
    const beforeEnd = !dateTo || leadTime <= new Date(`${dateTo}T23:59:59.999`).getTime();
    const visible = visibility === "all" || (visibility === "archived" ? l.archived : !l.archived);
    return visible && queueMatch(l) && afterStart && beforeEnd && (status === "all" || l.status === status) && (channel === "all" || channelFor(l) === channel) &&
      (!q || [l.name, l.phone, l.email, l.campaignName].some((v) => v?.toLowerCase().includes(q)));
  }).sort((a, b) => {
    const aOverdue = a.nextFollowUpAt && new Date(a.nextFollowUpAt) <= new Date() ? 1 : 0;
    const bOverdue = b.nextFollowUpAt && new Date(b.nextFollowUpAt) <= new Date() ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return sortOrder === "newest" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }), [leads, search, channel, status, queue, dateFrom, dateTo, sortOrder, visibility]);
  const pageCount = Math.max(1, Math.ceil(allFiltered.length / pageSize));
  const filtered = allFiltered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, channel, status, queue, dateFrom, dateTo, sortOrder, pageSize, visibility]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const counts = useMemo(() => ({ total: leads.length, new: leads.filter((l) => l.status === "new").length, followUp: leads.filter((l) => l.status === "follow_up").length, converted: leads.filter((l) => l.status === "converted").length }), [leads]);
  const channelCounts = useMemo(() => ({
    all: leads.length,
    meta: leads.filter((l) => channelFor(l) === "meta").length,
    tiktok: leads.filter((l) => channelFor(l) === "tiktok").length,
    website: leads.filter((l) => channelFor(l) === "website").length,
    manual: leads.filter((l) => channelFor(l) === "manual").length,
    other: leads.filter((l) => channelFor(l) === "other").length,
  }), [leads]);
  const queueCounts = useMemo(() => ({
    starred: leads.filter((l) => l.starred).length,
    needs_action: leads.filter((l) => ["new", "attempted_contact", "unreachable"].includes(l.status)).length,
    follow_up: leads.filter((l) => l.status === "follow_up" || Boolean(l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date())).length,
    active: leads.filter((l) => ["contacted", "trial_scheduled", "trial_attended"].includes(l.status)).length,
    converted: leads.filter((l) => l.status === "converted").length,
    closed: leads.filter((l) => ["not_interested", "cold"].includes(l.status)).length,
    all: leads.length,
  }), [leads]);
  const formAnswers = active ? Object.entries(active.rawFormData || {}).filter(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    const normalizedValue = Array.isArray(value) ? value.join(", ").trim() : String(value ?? "").trim();
    return normalizedValue && !TECHNICAL_FORM_FIELDS.has(normalizedKey);
  }) : [];

  const update = async (lead: Lead, changes: Record<string, unknown>) => {
    setSaving(true); const res = await api.put<{ success: boolean; data: Lead }>("/api/leads", { id: lead.id, kind: lead.kind, ...changes }); setSaving(false);
    if (res.error) { toast.showToast(res.error.message, "error"); return false; }
    setLeads((old) => old.map((l) => l.id === lead.id ? { ...l, ...changes } as Lead : l)); return true;
  };
  const quickStatus = async (lead: Lead, value: LeadStatus) => update(lead, { status: value });
  const toggleStar = async (lead: Lead) => update(lead, { starred: !lead.starred });
  const openEdit = (lead: Lead) => { setActive(lead); setForm({ name: lead.name, phone: lead.phone, email: lead.email, source: lead.source, status: lead.status, assignedTo: lead.assignedTo, nextFollowUpAt: dateInput(lead.nextFollowUpAt), submittedAt: dateInput(lead.submittedAt), notes: lead.notes, lostReason: lead.lostReason }); setModal("edit"); };
  const saveForm = async () => {
    setSaving(true);
    const payload = { ...form, nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null, submittedAt: form.submittedAt ? new Date(form.submittedAt).toISOString() : null };
    const res = active ? await api.put<{ success: boolean; data: Lead }>("/api/leads", { id: active.id, kind: active.kind, ...payload }) : await api.post<{ success: boolean; data: Lead }>("/api/leads", payload);
    setSaving(false); if (res.error) return toast.showToast(res.error.message, "error");
    await load(); setModal(null); setActive(null); setForm(blankForm); toast.showToast(active ? "Lead updated" : "Lead added", "success");
  };
  const openBook = async (lead: Lead) => { setActive(lead); setClassId(""); setModal("book"); const res = await api.get<{ success: boolean; data: ClassOption[] }>("/api/leads/classes"); setClasses(res.data?.data || []); };
  const book = async () => { if (!active || !classId) return; setSaving(true); const res = await api.post<{ success: boolean }>("/api/leads/book", { leadId: active.id, classId }); setSaving(false); if (res.error) return toast.showToast(res.error.message, "error"); setModal(null); await load(); toast.showToast("Class booked", "success"); };
  const remove = async (lead: Lead) => { if (!confirm(`Delete ${lead.name}?`)) return; const res = await api.delete(`/api/leads?id=${encodeURIComponent(lead.id)}&kind=${lead.kind}`); if (res.error) return toast.showToast(res.error.message, "error"); setLeads((old) => old.filter((l) => l.id !== lead.id)); };
  const chooseCsv = async (file?: File) => {
    setImportError(""); setImportRows([]); setImportFile(""); if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return setImportError("Please select a CSV file.");
    const rows = parseCsv(await file.text());
    if (!rows.length) return setImportError("The CSV has no data rows.");
    if (rows.length > 500) return setImportError("Import a maximum of 500 rows at a time.");
    setImportFile(file.name); setImportRows(rows);
  };
  const importCsv = async () => {
    if (!importRows.length) return; setSaving(true);
    const res = await api.post<{ success: boolean; data: { received: number; inserted: number; duplicates: number; skippedInvalid: number } }>("/api/leads/import", { filename: importFile, records: importRows });
    setSaving(false); if (res.error) return setImportError(res.error.message);
    const result = res.data?.data; setModal(null); setImportRows([]); await load();
    toast.showToast(`Import complete: ${result?.inserted || 0} added, ${result?.duplicates || 0} duplicates, ${result?.skippedInvalid || 0} invalid`, "success");
  };
  const leadKey = (lead: Lead) => `${lead.kind}:${lead.id}`;
  const selectedItems = leads.filter((lead) => selected.has(leadKey(lead))).map((lead) => ({ id: lead.id, kind: lead.kind }));
  const toggleLead = (lead: Lead) => setSelected((current) => { const next = new Set(current); const key = leadKey(lead); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const togglePage = () => setSelected((current) => { const next = new Set(current); const allSelected = filtered.every((lead) => next.has(leadKey(lead))); filtered.forEach((lead) => allSelected ? next.delete(leadKey(lead)) : next.add(leadKey(lead))); return next; });
  const selectAllFiltered = () => setSelected(new Set(allFiltered.map(leadKey)));
  const runBulk = async (action: "status" | "assign" | "follow_up" | "archive" | "restore" | "delete", value?: string) => {
    if (!selectedItems.length) return;
    if (action === "delete" && !confirm(`Permanently delete ${selectedItems.length} selected leads? This cannot be undone.`)) return;
    setSaving(true); const res = await api.post<{ success: boolean; data: { affected: number; skipped: number } }>("/api/leads/bulk", { items: selectedItems, action, value }); setSaving(false);
    if (res.error) return toast.showToast(res.error.message, "error");
    const result = res.data?.data; setSelected(new Set()); await load(); toast.showToast(`${result?.affected || 0} leads updated${result?.skipped ? `, ${result.skipped} skipped` : ""}`, "success");
  };

  return <div className="lead-crm-page space-y-6">
    <PageBreadCrumb pageTitle="Leads CRM" />
    <div className="flex justify-end"><Link href="/leads/analytics" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"><span aria-hidden>▥</span> Lead Analytics</Link></div>
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold uppercase text-gray-400">Visibility</span>{(["active", "archived", "all"] as const).map((item) => <button key={item} onClick={() => setVisibility(item)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${visibility === item ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>{item}</button>)}<span className="mx-2 hidden h-6 w-px bg-gray-200 sm:block" /><button onClick={togglePage} className="rounded-lg border px-3 py-1.5 text-sm">Select page</button><button onClick={selectAllFiltered} className="rounded-lg border px-3 py-1.5 text-sm">Select all {allFiltered.length}</button>{selected.size > 0 && <button onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-sm text-red-600">Clear selection</button>}</div>
      {selected.size > 0 && <div className="flex flex-wrap items-end gap-2 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/30"><div className="mr-2 self-center font-bold text-indigo-700 dark:text-indigo-300">{selected.size} selected</div><label><span className="block text-[10px] font-bold uppercase text-gray-400">Set status</span><div className="flex"><select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as LeadStatus)} className="rounded-l-lg border px-2 py-1.5 text-sm dark:bg-gray-700">{STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select><button disabled={saving} onClick={() => runBulk("status", bulkStatus)} className="rounded-r-lg bg-indigo-600 px-3 text-sm font-semibold text-white">Apply</button></div></label><label><span className="block text-[10px] font-bold uppercase text-gray-400">Assign owner</span><div className="flex"><select value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} className="rounded-l-lg border px-2 py-1.5 text-sm dark:bg-gray-700"><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button disabled={saving} onClick={() => runBulk("assign", bulkAssignee)} className="rounded-r-lg bg-indigo-600 px-3 text-sm font-semibold text-white">Apply</button></div></label><label><span className="block text-[10px] font-bold uppercase text-gray-400">Follow-up</span><div className="flex"><input type="datetime-local" value={bulkFollowUp} onChange={(e) => setBulkFollowUp(e.target.value)} className="rounded-l-lg border px-2 py-1.5 text-sm dark:bg-gray-700" /><button disabled={saving || !bulkFollowUp} onClick={() => runBulk("follow_up", new Date(bulkFollowUp).toISOString())} className="rounded-r-lg bg-indigo-600 px-3 text-sm font-semibold text-white disabled:opacity-50">Apply</button></div></label><div className="ml-auto flex gap-2"><button disabled={saving} onClick={() => runBulk(visibility === "archived" ? "restore" : "archive")} className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white">{visibility === "archived" ? "Restore" : "Archive"}</button><button disabled={saving} onClick={() => runBulk("delete")} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Delete</button></div></div>}
    </div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads CRM</h1><p className="mt-1 text-sm text-gray-500">Meta, TikTok, website and manually entered leads in one pipeline.</p></div><div className="flex gap-2"><button onClick={() => { setImportFile(""); setImportRows([]); setImportError(""); setModal("import"); }} className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">Import CSV</button><button onClick={() => { setActive(null); setForm(blankForm); setModal("add"); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">+ Add lead</button></div></div>
    <div className="grid gap-3 sm:grid-cols-4">{[["Total leads", counts.total], ["New", counts.new], ["Follow-up", counts.followUp], ["Converted", counts.converted]].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs font-medium uppercase text-gray-400">{label}</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</div></div>)}</div>
    <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Work queue</h2><div className="flex gap-2 overflow-x-auto pb-1">{(["starred", "needs_action", "follow_up", "active", "converted", "closed", "all"] as WorkQueue[]).map((item) => <button key={item} onClick={() => setQueue(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold capitalize ${queue === item ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>{item === "starred" ? "★ Starred" : item.replaceAll("_", " ")} ({queueCounts[item]})</button>)}</div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{(["all", "meta", "tiktok", "website", "manual", "other"] as LeadChannel[]).map((item) => <button key={item} onClick={() => setChannel(item)} className={`whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${channel === item ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>{item === "all" ? "All leads" : item === "meta" ? "Meta (FB + IG)" : item} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${channel === item ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"}`}>{channelCounts[item]}</span></button>)}</div>
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="xl:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or campaign" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" /></label>
      <label><span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Status</span><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-semibold uppercase text-gray-400">From date</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" /></label>
      <label><span className="mb-1 block text-xs font-semibold uppercase text-gray-400">To date</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" /></label>
      <label><span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Order</span><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div><div className="mt-3 flex items-center justify-between"><span className="text-sm text-gray-500">{allFiltered.length} matching leads</span><div className="flex gap-2"><button onClick={() => { setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); setChannel("all"); setQueue("all"); setSortOrder("newest"); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Clear filters</button><button onClick={load} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Refresh</button></div></div></div>
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">{loading ? <div className="p-12 text-center text-gray-500">Loading…</div> : error ? <div className="p-12 text-center text-red-600">{error}</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/40"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select current page" checked={filtered.length > 0 && filtered.every((lead) => selected.has(leadKey(lead)))} onChange={togglePage} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></th><th className="px-4 py-3">Lead</th><th className="px-4 py-3">Source / campaign</th><th className="px-4 py-3">Owner / follow-up</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Received</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map((lead) => <tr key={`${lead.kind}-${lead.id}`} className={selected.has(leadKey(lead)) ? "bg-indigo-50/80 dark:bg-indigo-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}><td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${lead.name}`} checked={selected.has(leadKey(lead))} onChange={() => toggleLead(lead)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></td><td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" disabled={lead.kind !== "marketing" || saving} onClick={() => toggleStar(lead)} aria-label={lead.starred ? `Unstar ${lead.name}` : `Star ${lead.name}`} className={`text-xl leading-none ${lead.starred ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}>{lead.starred ? "★" : "☆"}</button><span className="font-semibold text-gray-900 dark:text-white">{lead.name}</span></div><div className="text-xs text-gray-500">{lead.phone || "No phone"} · {lead.email || "No email"}</div><div className="mt-1 flex gap-1">{lead.phone && <><a href={`tel:${lead.phone}`} className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Call</a><a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">WhatsApp</a></>}</div></td><td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold uppercase text-gray-600">{lead.source}</span><div className="mt-1 max-w-52 truncate text-xs text-gray-500">{lead.campaignName || lead.promoLabel || "—"}</div></td><td className="px-4 py-3"><div>{lead.assignedName || "Unassigned"}</div><div className={`text-xs ${lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() ? "font-semibold text-red-600" : "text-gray-500"}`}>{lead.nextFollowUpAt ? `Follow up ${fmt(lead.nextFollowUpAt)}` : "No follow-up"}</div></td><td className="px-4 py-3"><select value={lead.status} disabled={saving} onChange={(e) => quickStatus(lead, e.target.value as LeadStatus)} className={`rounded-lg border-0 px-2 py-1 text-xs font-semibold capitalize ${statusClass[lead.status]}`}>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></td><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500"><div>{lead.submittedAt ? fmt(lead.submittedAt) : "Original date unavailable"}</div><div className={`mt-1 font-semibold ${lead.status === "new" ? "text-orange-600" : "text-gray-400"}`}>{ageLabel(lead.createdAt)}</div></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => { setActive(lead); setModal("view"); }} className="rounded px-2 py-1 text-xs hover:bg-gray-100">View</button><button onClick={() => openEdit(lead)} className="rounded px-2 py-1 text-xs hover:bg-gray-100">Edit</button><button onClick={() => openBook(lead)} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Book</button>{lead.kind === "marketing" && <button onClick={() => remove(lead)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="p-10 text-center text-sm text-gray-500">No matching leads.</div>}</div>}</div>

    {!loading && !error && allFiltered.length > 0 && <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row"><div className="text-gray-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, allFiltered.length)} of {allFiltered.length}</div><div className="flex items-center gap-2"><label className="text-gray-500">Rows <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="ml-1 rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-600 dark:bg-gray-700">{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span className="min-w-20 text-center">Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>}

    {(modal === "add" || modal === "edit") && <Modal title={modal === "add" ? "Add lead" : `Edit ${active?.name}`} onClose={() => setModal(null)}><div className="grid gap-4 sm:grid-cols-2">{[["Name", "name"], ["Phone", "phone"], ["Email", "email"]].map(([label, key]) => <label key={key} className={key === "name" ? "sm:col-span-2" : ""}><span className="mb-1 block text-sm font-medium">{label}</span><input value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" /></label>)}
      <label><span className="mb-1 block text-sm font-medium">Source</span><select disabled={modal === "edit" && active?.kind === "quick_join"} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-700">{["manual", "meta", "facebook", "instagram", "tiktok", "website", "google_sheets", "other"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label><span className="mb-1 block text-sm font-medium">Assign to</span><select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} disabled={active?.kind === "quick_join"} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-700"><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Next follow-up</span><input type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} disabled={active?.kind === "quick_join"} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-700" /></label>
      <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Original lead date</span><input type="datetime-local" value={form.submittedAt} onChange={(e) => setForm({ ...form, submittedAt: e.target.value })} disabled={active?.kind === "quick_join"} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-700" /><span className="mt-1 block text-xs text-gray-400">For TikTok rows without a date, set the best known submission date here.</span></label>
      <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Notes</span><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-700" /></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving || !form.name || (!form.phone && !form.email)} onClick={saveForm} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save lead"}</button></div></Modal>}
    {modal === "view" && active && <Modal title="Lead details" onClose={() => setModal(null)} wide><div className="grid gap-4 text-sm sm:grid-cols-2">{[["Name", active.name], ["Source", active.source], ["Phone", active.phone || "—"], ["Email", active.email || "—"], ["Campaign", active.campaignName || "—"], ["Ad set", active.adsetName || "—"], ["Ad", active.adName || "—"], ["Form", active.formName || "—"], ["External lead ID", active.externalId || "—"], ["Imported from", active.importedFrom || "—"], ["Owner", active.assignedName || "Unassigned"], ["Follow-up", fmt(active.nextFollowUpAt)], ["Last contacted", fmt(active.lastContactedAt)], ["Lead submitted", active.submittedAt ? fmt(active.submittedAt) : "Unavailable in source file"], ["Imported into dashboard", fmt(active.importedAt)]].map(([k, v]) => <div key={k} className="border-b border-gray-100 pb-2"><div className="text-xs uppercase text-gray-400">{k}</div><div className="mt-1 break-all font-medium text-gray-900 dark:text-white">{v}</div></div>)}</div><div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"><div className="text-xs font-bold uppercase tracking-wide text-indigo-600">Form answers</div>{formAnswers.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{formAnswers.map(([key, value]) => <div key={key} className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800"><div className="text-xs font-medium text-gray-500">{formLabel(key)}</div><div className="mt-1 whitespace-pre-wrap font-semibold text-gray-900 dark:text-white">{Array.isArray(value) ? value.join(", ") : String(value)}</div></div>)}</div> : <p className="mt-2 text-sm text-gray-500">No qualifying-question answers were included in this imported row.</p>}</div><div className="mt-4"><div className="text-xs uppercase text-gray-400">Notes</div><p className="mt-1 whitespace-pre-wrap text-sm">{active.notes || "No notes yet."}</p></div></Modal>}
    {modal === "import" && <Modal title="Import leads from CSV" onClose={() => setModal(null)}><div className="space-y-4"><p className="text-sm text-gray-500">Upload a Meta, TikTok or Google Sheets CSV. Known columns are mapped automatically and every original field is preserved.</p><label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-400 dark:border-gray-600"><span className="block font-semibold text-gray-700 dark:text-gray-200">Choose CSV file</span><span className="mt-1 block text-xs text-gray-400">Maximum 500 rows per import</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => chooseCsv(e.target.files?.[0])} /></label>{importFile && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-semibold">{importFile}</div><div>{importRows.length} data rows ready · {Object.keys(importRows[0] || {}).length} columns detected</div><div className="mt-1 truncate text-xs">Columns: {Object.keys(importRows[0] || {}).join(", ")}</div></div>}{importError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{importError}</div>}<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button onClick={importCsv} disabled={!importRows.length || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Importing…" : `Import ${importRows.length || ""} leads`}</button></div></div></Modal>}
    {modal === "book" && active && <Modal title={`Book ${active.name}`} onClose={() => setModal(null)}><div className="space-y-3">{classes.map((c) => <label key={c.id} className="flex cursor-pointer gap-3 rounded-lg border p-3"><input type="radio" name="class" checked={classId === c.id} onChange={() => setClassId(c.id)} disabled={c.bookedCount >= c.capacity} /><span><span className="block font-medium">{c.title}</span><span className="text-xs text-gray-500">{fmt(c.scheduledAt)} · {c.location} · {c.bookedCount}/{c.capacity}</span></span></label>)}{!classes.length && <p className="text-sm text-gray-500">No upcoming classes.</p>}<button disabled={!classId || saving} onClick={book} className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirm booking</button></div></Modal>}
  </div>;
}
