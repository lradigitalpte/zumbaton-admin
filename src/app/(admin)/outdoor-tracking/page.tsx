"use client";

import { useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

interface Enrollment {
  id: string;
  program_type: "zt_fiesta" | "individual_lesson";
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  participant_name: string | null;
  package_label: string | null;
  sessions_purchased: number;
  sessions_used: number;
  price_cents: number;
  payment_status: string;
  attendance_status: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function OutdoorTrackingPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [programType, setProgramType] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmPaidModalOpen, setConfirmPaidModalOpen] = useState(false);
  const [confirmAttendanceModalOpen, setConfirmAttendanceModalOpen] = useState(false);
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Enrollment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    programType: "individual_lesson",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    participantName: "",
    packageLabel: "Individual Lesson",
    sessionsPurchased: 1,
    sessionsUsed: 0,
    priceCents: 0,
    paymentStatus: "pending",
    attendanceStatus: "not_started",
    validUntil: "",
    notes: "",
  });

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      search,
      programType,
      paymentStatus,
    });

    const response = await api.get<{ success: boolean; data: Enrollment[]; pagination: { totalPages: number } }>(
      `/api/outdoor-tracking?${params.toString()}`,
    );
    if (response.error) {
      showToast(response.error.message || "Failed to load records", "error");
      setLoading(false);
      return;
    }

    const payload = response.data as any;
    setSetupMessage(payload?.setupRequired ? payload?.message || "Setup required" : null);
    setRows(Array.isArray(payload?.data) ? payload.data : []);
    setTotalPages(payload?.pagination?.totalPages || 1);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [page, programType, paymentStatus]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (page === 1) fetchRows();
      else setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const response = await api.post("/api/outdoor-tracking", {
      ...form,
      sessionsPurchased: Number(form.sessionsPurchased),
      sessionsUsed: Number(form.sessionsUsed),
      priceCents: Number(form.priceCents),
      validUntil: form.validUntil || null,
    });

    if (response.error) {
      showToast(response.error.message || "Failed to create record", "error");
      setSubmitting(false);
      return;
    }

    showToast("Record created", "success");
    setCreateModalOpen(false);
    setSubmitting(false);
    setForm({
      programType: "individual_lesson",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      participantName: "",
      packageLabel: "Individual Lesson",
      sessionsPurchased: 1,
      sessionsUsed: 0,
      priceCents: 0,
      paymentStatus: "pending",
      attendanceStatus: "not_started",
      validUntil: "",
      notes: "",
    });
    fetchRows();
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRow) return;
    setSubmitting(true);
    const response = await api.patch(`/api/outdoor-tracking/${selectedRow.id}`, {
      ...form,
      sessionsPurchased: Number(form.sessionsPurchased),
      sessionsUsed: Number(form.sessionsUsed),
      priceCents: Number(form.priceCents),
      validUntil: form.validUntil || null,
    });

    if (response.error) {
      showToast(response.error.message || "Failed to update record", "error");
      setSubmitting(false);
      return;
    }

    showToast("Record updated", "success");
    setEditModalOpen(false);
    setSubmitting(false);
    fetchRows();
  };

  const openEditModal = (row: Enrollment) => {
    setSelectedRow(row);
    setForm({
      programType: row.program_type,
      customerName: row.customer_name,
      customer_email: row.customer_email, // Note: form uses customerEmail, but Enrollment has customer_email
      customerPhone: row.customer_phone,
      participantName: row.participant_name || "",
      packageLabel: row.package_label || "",
      sessionsPurchased: row.sessions_purchased,
      sessionsUsed: row.sessions_used,
      priceCents: row.price_cents,
      paymentStatus: row.payment_status,
      attendanceStatus: row.attendance_status,
      validUntil: row.valid_until ? new Date(row.valid_until).toISOString().split("T")[0] : "",
      notes: row.notes || "",
    } as any);
    setEditModalOpen(true);
  };

  const updateRow = async (id: string, payload: Record<string, unknown>) => {
    const response = await api.patch(`/api/outdoor-tracking/${id}`, payload);
    if (response.error) {
      showToast(response.error.message || "Update failed", "error");
      return;
    }
    showToast("Record updated", "success");
    fetchRows();
  };

  const deleteRow = async (id: string) => {
    setSubmitting(true);
    const response = await api.delete(`/api/outdoor-tracking/${id}`);
    if (response.error) {
      showToast(response.error.message || "Delete failed", "error");
      setSubmitting(false);
      return;
    }
    showToast("Record deleted", "success");
    setConfirmDeleteModalOpen(false);
    setSubmitting(false);
    fetchRows();
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Outdoor Tracking" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outdoor & Manual Tracking</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage ZT Fiesta and individual lesson records manually
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
        >
          Add Record
        </button>
      </div>

      {setupMessage && (
        <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {setupMessage}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Search customer / email / phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
          <select value={programType} onChange={(e) => { setProgramType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
            <option value="all">All Programs</option>
            <option value="zt_fiesta">ZT Fiesta</option>
            <option value="individual_lesson">Individual Lesson</option>
          </select>
          <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="waived">Waived</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading records...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Validity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{row.customer_name}</p>
                    <p className="text-gray-500">{row.customer_email}</p>
                    <p className="text-gray-500">{row.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p className="capitalize text-gray-900 dark:text-white">{row.program_type.replace("_", " ")}</p>
                    <p className="text-gray-500">{row.package_label || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.sessions_used}/{row.sessions_purchased}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      row.payment_status === "paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : row.payment_status === "pending"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {row.payment_status.replace("_", " ")}
                    </span>
                    <p>${(row.price_cents / 100).toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-gray-700 dark:text-gray-300">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      row.attendance_status === "completed"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : row.attendance_status === "in_progress"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {row.attendance_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.valid_until ? new Date(row.valid_until).toLocaleDateString("en-SG") : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      {row.payment_status !== "paid" && (
                        <button 
                          onClick={() => { setSelectedRow(row); setConfirmPaidModalOpen(true); }} 
                          className="px-2 py-1 text-xs rounded bg-brand-500 hover:bg-brand-600 text-white whitespace-nowrap"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button 
                        onClick={() => { setSelectedRow(row); setConfirmAttendanceModalOpen(true); }} 
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white whitespace-nowrap"
                      >
                        + Attendance
                      </button>
                      <button 
                        onClick={() => openEditModal(row)} 
                        className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      >
                        Update Status
                      </button>
                      <button 
                        onClick={() => { setSelectedRow(row); setConfirmDeleteModalOpen(true); }} 
                        className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No records found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        className="max-w-[760px] w-full"
      >
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Outdoor Tracking Record</h3>
          {/* ... form content ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program Type *</label>
              <select
                value={form.programType}
                onChange={(e) => setForm((prev) => ({ ...prev, programType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="zt_fiesta">ZT Fiesta</option>
                <option value="individual_lesson">Individual Lesson</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package Label *</label>
              <input
                required
                placeholder="e.g. 2 sessions / Individual Lesson"
                value={form.packageLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, packageLabel: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Primary Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Contact Name *" value={form.customerName} onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              <input required type="email" placeholder="Contact Email *" value={form.customerEmail} onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              <input required placeholder="Contact Phone *" value={form.customerPhone} onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))} className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Participant (optional if same as contact)</h4>
            <input placeholder="Participant Name" value={form.participantName} onChange={(e) => setForm((prev) => ({ ...prev, participantName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions Purchased *</label>
              <input
                type="number"
                min={1}
                value={form.sessionsPurchased}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionsPurchased: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions Used</label>
              <input
                type="number"
                min={0}
                value={form.sessionsUsed}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionsUsed: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (cents) *</label>
              <input
                type="number"
                min={0}
                value={form.priceCents}
                onChange={(e) => setForm((prev) => ({ ...prev, priceCents: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Example: 2800 = SGD 28.00
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        className="max-w-[760px] w-full"
      >
        <form onSubmit={handleEdit} className="p-6 space-y-5">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Update Outdoor Tracking Record</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program Type *</label>
              <select
                value={form.programType}
                onChange={(e) => setForm((prev) => ({ ...prev, programType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="zt_fiesta">ZT Fiesta</option>
                <option value="individual_lesson">Individual Lesson</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package Label *</label>
              <input
                required
                placeholder="e.g. 2 sessions / Individual Lesson"
                value={form.packageLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, packageLabel: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Primary Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Contact Name *" value={form.customerName} onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              <input required type="email" placeholder="Contact Email *" value={(form as any).customer_email || form.customerEmail} onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value, customer_email: e.target.value } as any))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              <input required placeholder="Contact Phone *" value={form.customerPhone} onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))} className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Participant (optional if same as contact)</h4>
            <input placeholder="Participant Name" value={form.participantName} onChange={(e) => setForm((prev) => ({ ...prev, participantName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions Purchased *</label>
              <input
                type="number"
                min={1}
                value={form.sessionsPurchased}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionsPurchased: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions Used</label>
              <input
                type="number"
                min={0}
                value={form.sessionsUsed}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionsUsed: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (cents) *</label>
              <input
                type="number"
                min={0}
                value={form.priceCents}
                onChange={(e) => setForm((prev) => ({ ...prev, priceCents: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="waived">Waived</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attendance Status</label>
              <select
                value={form.attendanceStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, attendanceStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update Record"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={confirmPaidModalOpen}
        onClose={() => setConfirmPaidModalOpen(false)}
        className="max-w-[400px] w-full"
      >
        <div className="p-6 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Confirm Payment</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to mark the payment for <strong>{selectedRow?.customer_name}</strong> as paid?
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setConfirmPaidModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (selectedRow) {
                  await updateRow(selectedRow.id, { markPaid: true });
                  setConfirmPaidModalOpen(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmAttendanceModalOpen}
        onClose={() => setConfirmAttendanceModalOpen(false)}
        className="max-w-[400px] w-full"
      >
        <div className="p-6 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Confirm Attendance</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add 1 session to attendance for <strong>{selectedRow?.customer_name}</strong>?
            <br />
            <span className="text-sm text-gray-500">
              Current: {selectedRow?.sessions_used}/{selectedRow?.sessions_purchased}
            </span>
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setConfirmAttendanceModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (selectedRow) {
                  const newUsed = Math.min(selectedRow.sessions_purchased, selectedRow.sessions_used + 1);
                  await updateRow(selectedRow.id, { 
                    sessionsUsed: newUsed, 
                    attendanceStatus: newUsed >= selectedRow.sessions_purchased ? "completed" : "in_progress" 
                  });
                  setConfirmAttendanceModalOpen(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={confirmDeleteModalOpen}
        onClose={() => setConfirmDeleteModalOpen(false)}
        className="max-w-[400px] w-full"
      >
        <div className="p-6 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete the record for <strong>{selectedRow?.customer_name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setConfirmDeleteModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={submitting}
              onClick={() => selectedRow && deleteRow(selectedRow.id)}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
