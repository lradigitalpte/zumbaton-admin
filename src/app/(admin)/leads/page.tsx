"use client";

import { useEffect, useState, useCallback } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface Lead {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  venue: string;
  promoLabel: string;
  paymentTerms: string;
  preferredNote: string;
  fullAmount: number;
  chargedAmount: number;
  balance: number;
  amount: number;
  provider: string;
  paymentStatus: string;
  leadStatus: "new" | "contacted" | "scheduled" | "done";
  bookedClassTitle: string;
  bookedClassAt: string;
}

interface ClassOption {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  capacity: number;
  isOutdoor: boolean;
  location: string;
  bookedCount: number;
}

const LEAD_STATUS_OPTIONS: Lead["leadStatus"][] = ["new", "contacted", "scheduled", "done"];

function paymentBadge(lead: Lead) {
  if (lead.paymentStatus === "succeeded" || lead.paymentStatus === "completed") {
    const label = lead.balance > 0 ? `Deposit $${lead.chargedAmount.toFixed(2)} paid` : "Paid";
    return { label, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  }
  if (lead.provider === "pay_at_studio") {
    return { label: "Pay at studio", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  }
  if (lead.paymentStatus === "failed") {
    return { label: "Failed", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  return { label: "Unpaid", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
}

const leadStatusCls: Record<Lead["leadStatus"], string> = {
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  contacted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  scheduled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  done: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const fmtDateTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Date (YYYY-MM-DD) of a timestamp in Singapore time.
const toSGTDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore" });
const fmtDateChip = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Lead["leadStatus"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<null | "view" | "edit" | "book">(null);
  const [active, setActive] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", preferredNote: "" });
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ success: boolean; data: Lead[] }>("/api/leads");
    if (res.error) setError(res.error.message || "Failed to load leads");
    else { setError(null); setLeads(res.data?.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, leadStatus: Lead["leadStatus"]) => {
    setSavingId(id);
    const res = await api.put<{ success: boolean }>("/api/leads", { id, leadStatus });
    if (!res.error) setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, leadStatus } : l)));
    setSavingId(null);
  };

  const openView = (lead: Lead) => { setActive(lead); setModal("view"); };
  const openEdit = (lead: Lead) => {
    setActive(lead);
    setEditForm({ name: lead.name, phone: lead.phone, email: lead.email, preferredNote: lead.preferredNote });
    setModalError(null);
    setModal("edit");
  };
  const openBook = async (lead: Lead) => {
    setActive(lead);
    setSelectedClassId("");
    setModalError(null);
    setModal("book");
    setClassesLoading(true);
    const res = await api.get<{ success: boolean; data: ClassOption[] }>("/api/leads/classes");
    const list = res.data?.data || [];
    setClasses(list);
    const dates = [...new Set(list.map((c) => toSGTDate(c.scheduledAt)))].sort();
    setBookDate(dates[0] || "");
    setClassesLoading(false);
  };
  const closeModal = () => { setModal(null); setActive(null); };

  const saveEdit = async () => {
    if (!active) return;
    setModalBusy(true); setModalError(null);
    const res = await api.put<{ success: boolean }>("/api/leads", { id: active.id, ...editForm });
    setModalBusy(false);
    if (res.error) { setModalError(res.error.message || "Failed to save"); return; }
    setLeads((prev) => prev.map((l) => (l.id === active.id ? { ...l, ...editForm } : l)));
    closeModal();
  };

  const confirmBook = async () => {
    if (!active || !selectedClassId) { setModalError("Pick a class first"); return; }
    setModalBusy(true); setModalError(null);
    const res = await api.post<{ success: boolean; data: { classTitle: string; classAt: string; emailSent: boolean } }>("/api/leads/book", {
      leadId: active.id,
      classId: selectedClassId,
    });
    setModalBusy(false);
    if (res.error) { setModalError(res.error.message || "Failed to book"); return; }
    const booked = res.data?.data;
    setLeads((prev) => prev.map((l) => (l.id === active.id
      ? { ...l, leadStatus: "scheduled", bookedClassTitle: booked?.classTitle || "", bookedClassAt: booked?.classAt || "" }
      : l)));
    toast.showToast(
      `Booked into ${booked?.classTitle || "class"}.${booked?.emailSent ? " Confirmation email sent to client." : " (Confirmation email could not be sent.)"}`,
      booked?.emailSent ? "success" : "warning"
    );
    closeModal();
  };

  const deleteLead = async (lead: Lead) => {
    if (!confirm(`Delete lead "${lead.name}"? This also removes any class booking created from it.`)) return;
    setSavingId(lead.id);
    const res = await api.delete<{ success: boolean }>(`/api/leads?id=${encodeURIComponent(lead.id)}`);
    if (!res.error) setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    setSavingId(null);
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.leadStatus === filter);
  const counts = {
    all: leads.length,
    new: leads.filter((l) => l.leadStatus === "new").length,
    contacted: leads.filter((l) => l.leadStatus === "contacted").length,
    scheduled: leads.filter((l) => l.leadStatus === "scheduled").length,
    done: leads.filter((l) => l.leadStatus === "done").length,
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Leads" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads — pay-first sign-ups</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          People who joined via the <span className="font-medium">/start</span> page. Contact them, then
          book them into a class — that creates a real booking and counts against capacity.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "contacted", "scheduled", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading leads…</div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">No leads yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((lead) => {
                  const badge = paymentBadge(lead);
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        <div>{lead.phone || "—"}</div>
                        <div className="text-xs text-gray-400">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {lead.bookedClassTitle ? (
                          <div className="text-xs">
                            <div className="font-medium text-emerald-600 dark:text-emerald-400">Booked: {lead.bookedClassTitle}</div>
                            <div className="text-gray-400">{fmtDateTime(lead.bookedClassAt)}</div>
                          </div>
                        ) : (
                          <>
                            {lead.promoLabel}
                            {lead.balance > 0 && (
                              <div className="text-xs text-amber-600 dark:text-amber-400">Balance ${lead.balance.toFixed(2)} at studio</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDateTime(lead.createdAt)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.leadStatus}
                          disabled={savingId === lead.id}
                          onChange={(e) => updateStatus(lead.id, e.target.value as Lead["leadStatus"])}
                          className={`rounded-lg border-0 px-2 py-1 text-xs font-semibold capitalize ${leadStatusCls[lead.leadStatus]}`}
                        >
                          {LEAD_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openView(lead)} className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">View</button>
                          <button onClick={() => openEdit(lead)} className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Edit</button>
                          <button onClick={() => openBook(lead)} className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700">Book</button>
                          <button onClick={() => deleteLead(lead)} disabled={savingId === lead.id} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View modal */}
      {modal === "view" && active && (
        <Modal title="Lead details" onClose={closeModal}>
          <dl className="space-y-3 text-sm">
            {[
              ["Name", active.name],
              ["Phone", active.phone || "—"],
              ["Email", active.email || "—"],
              ["Class type", active.promoLabel],
              ["Payment terms", active.paymentTerms],
              ["Paid online", `$${active.chargedAmount.toFixed(2)}`],
              ["Balance at studio", `$${active.balance.toFixed(2)}`],
              ["Prefers", active.preferredNote || "—"],
              ["Booked class", active.bookedClassTitle ? `${active.bookedClassTitle} · ${fmtDateTime(active.bookedClassAt)}` : "Not booked yet"],
              ["Created", fmtDateTime(active.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-2 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="text-right font-medium text-gray-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {/* Edit modal */}
      {modal === "edit" && active && (
        <Modal title="Edit lead" onClose={closeModal}>
          <div className="space-y-4">
            {([
              ["Name", "name"],
              ["Phone", "phone"],
              ["Email", "email"],
              ["Prefers (when)", "preferredNote"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                <input
                  value={editForm[key]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                />
              </div>
            ))}
            {modalError && <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={saveEdit} disabled={modalBusy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {modalBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Book modal */}
      {modal === "book" && active && (() => {
        const availableDates = [...new Set(classes.map((c) => toSGTDate(c.scheduledAt)))].sort();
        const dayClasses = classes
          .filter((c) => toSGTDate(c.scheduledAt) === bookDate)
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        const otherDates = availableDates.filter((d) => d !== bookDate);
        return (
        <Modal title={`Book ${active.name} into a class`} onClose={closeModal} wide>
          {classesLoading ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading classes…</div>
          ) : classes.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No upcoming scheduled classes.</div>
          ) : (
            <div className="space-y-4">
              {/* Date picker */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  value={bookDate}
                  min={availableDates[0]}
                  max={availableDates[availableDates.length - 1]}
                  onChange={(e) => { setBookDate(e.target.value); setSelectedClassId(""); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 sm:w-auto"
                />
                {otherDates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherDates.slice(0, 8).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setBookDate(d); setSelectedClassId(""); }}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {fmtDateChip(d)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Classes on the chosen date */}
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {dayClasses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No classes on this date. Pick another date above.
                  </div>
                ) : (
                  dayClasses.map((c) => {
                    const full = c.bookedCount >= c.capacity;
                    const selected = selectedClassId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={full}
                        onClick={() => setSelectedClassId(c.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          selected ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                          : full ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900/30"
                          : "border-gray-200 hover:border-indigo-400 dark:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">{c.title}</span>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{c.isOutdoor ? "Outdoor" : "Studio"}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{fmtTime(c.scheduledAt)} · {c.durationMinutes} min{c.location ? ` · ${c.location}` : ""}</span>
                          <span className={full ? "font-semibold text-red-500" : ""}>{full ? "Full" : `${c.bookedCount}/${c.capacity} booked`}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {modalError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{modalError}</p>}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">A confirmation email is sent to the client on booking.</p>
            <div className="flex gap-2">
              <button onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={confirmBook} disabled={modalBusy || !selectedClassId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {modalBusy ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}
