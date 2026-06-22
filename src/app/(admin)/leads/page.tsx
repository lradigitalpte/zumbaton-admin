"use client";

import { useEffect, useState, useCallback } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { api } from "@/lib/api-client";

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Lead["leadStatus"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ success: boolean; data: Lead[] }>("/api/leads");
    if (res.error) {
      setError(res.error.message || "Failed to load leads");
    } else {
      setError(null);
      setLeads(res.data?.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, leadStatus: Lead["leadStatus"]) => {
    setSavingId(id);
    const res = await api.put<{ success: boolean }>("/api/leads", { id, leadStatus });
    if (!res.error) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, leadStatus } : l)));
    }
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
          People who joined via the <span className="font-medium">/start</span> page. Contact them to
          schedule their class. Paid leads need scheduling; &ldquo;Pay at studio&rdquo; leads also owe payment on arrival.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "contacted", "scheduled", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
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
                  <th className="px-4 py-3 font-semibold">Prefers</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
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
                        {lead.promoLabel}
                        {lead.balance > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">Balance ${lead.balance.toFixed(2)} at studio</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{lead.preferredNote || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(lead.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`hidden rounded-md px-2 py-1 text-xs font-semibold capitalize sm:inline-block ${leadStatusCls[lead.leadStatus]}`}>
                            {lead.leadStatus}
                          </span>
                          <select
                            value={lead.leadStatus}
                            disabled={savingId === lead.id}
                            onChange={(e) => updateStatus(lead.id, e.target.value as Lead["leadStatus"])}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs capitalize dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {LEAD_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
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
    </div>
  );
}
