"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/tables/Pagination";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/modal";
import StudioDate from "@/components/ui/StudioDate";
import StudioMenu from "@/components/ui/StudioMenu";

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
const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";
const area = "w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";
const label = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400";
const sheet = "max-h-[90vh] w-[min(760px,calc(100vw-2rem))] overflow-y-auto !rounded-[28px] !border-neutral-200/80 !bg-white p-6 dark:!border-white/10 dark:!bg-gray-800";
const programOptions = [
  { value: "zt_fiesta", label: "ZT Fiesta" },
  { value: "individual_lesson", label: "Individual lesson" },
];
const paymentOptions = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "waived", label: "Waived" },
  { value: "cancelled", label: "Cancelled" },
];
const attendanceOptions = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

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
      customerEmail: row.customer_email,
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
    });
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
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">Outdoor tracking</h1>
          <p className="mt-1 text-sm text-neutral-500">ZT Fiesta and individual lessons recorded by hand.</p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]">Add record</button>
      </div>

      {setupMessage && (
        <div className="rounded-[28px] bg-[#E4F56C]/40 px-5 py-4 text-sm font-medium text-neutral-950">{setupMessage}</div>
      )}

      <div className={`${card} p-5`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <input placeholder="Search name, email, or phone" value={search} onChange={(e) => setSearch(e.target.value)} className={field} />
          <StudioMenu value={programType} onChange={(value) => { setProgramType(value); setPage(1); }} placeholder="All programs" options={[{ value: "all", label: "All programs" }, ...programOptions]} />
          <StudioMenu value={paymentStatus} onChange={(value) => { setPaymentStatus(value); setPage(1); }} placeholder="All payments" options={[{ value: "all", label: "All payments" }, ...paymentOptions]} />
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-[22px] px-6 py-12 text-center text-sm text-neutral-500">Loading records…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-[22px] px-6 py-12 text-center text-sm text-neutral-500">No records match these filters.</div>
          ) : rows.map((row) => {
            const fill = row.sessions_purchased > 0 ? Math.min(100, Math.round((row.sessions_used / row.sessions_purchased) * 100)) : 0;
            const paymentTone = row.payment_status === "paid" ? "bg-[#E4F56C] text-neutral-950" : row.payment_status === "pending" ? "bg-neutral-950 text-[#E4F56C]" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white";
            const attendanceTone = row.attendance_status === "completed" ? "bg-neutral-950 text-white" : row.attendance_status === "in_progress" ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white";
            return (
              <article key={row.id} className="rounded-[22px] bg-neutral-50 p-4 dark:bg-white/5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-[#E4F56C]">
                      {(row.customer_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{row.customer_name}</p>
                      <p className="truncate text-sm text-neutral-500">{row.customer_email}</p>
                      <p className="truncate text-sm text-neutral-400">{row.customer_phone}</p>
                    </div>
                  </div>
                  <div className="min-w-0 xl:w-44">
                    <p className="text-sm font-semibold capitalize text-neutral-950 dark:text-white">{row.program_type.replaceAll("_", " ")}</p>
                    <p className="truncate text-sm text-neutral-500">{row.package_label || "No package"}</p>
                  </div>
                  <div className="xl:w-28">
                    <p className="text-lg font-semibold text-neutral-950 dark:text-white">{row.sessions_used}<span className="text-sm font-medium text-neutral-400">/{row.sessions_purchased}</span></p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                      <div className="h-full rounded-full bg-neutral-950 dark:bg-[#E4F56C]" style={{ width: `${fill}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:w-52">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${paymentTone}`}>{row.payment_status.replaceAll("_", " ")}</span>
                    <span className="text-sm font-semibold text-neutral-950 dark:text-white">${(row.price_cents / 100).toFixed(2)}</span>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${attendanceTone}`}>{row.attendance_status.replaceAll("_", " ")}</span>
                  <p className="text-sm text-neutral-500 xl:w-24">{row.valid_until ? new Date(row.valid_until).toLocaleDateString("en-SG") : "No expiry"}</p>
                  <div className="flex flex-wrap gap-2">
                    {row.payment_status !== "paid" && (
                      <button onClick={() => { setSelectedRow(row); setConfirmPaidModalOpen(true); }} className="rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950">Mark paid</button>
                    )}
                    <button onClick={() => { setSelectedRow(row); setConfirmAttendanceModalOpen(true); }} className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">+ Attendance</button>
                    <button onClick={() => openEditModal(row)} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 dark:border-white/10 dark:bg-transparent dark:text-white">Update</button>
                    <button onClick={() => { setSelectedRow(row); setConfirmDeleteModalOpen(true); }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} showCloseButton={false} className={sheet}>
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Add record</h3>
            <button type="button" onClick={() => setCreateModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-lg text-white" aria-label="Close">×</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={label}>Program</span><StudioMenu value={form.programType} onChange={(value) => setForm((prev) => ({ ...prev, programType: value }))} placeholder="Program" options={programOptions} /></label>
            <label><span className={label}>Package</span><input required placeholder="2 sessions" value={form.packageLabel} onChange={(e) => setForm((prev) => ({ ...prev, packageLabel: e.target.value }))} className={field} /></label>
          </div>
          <div className="rounded-[22px] bg-neutral-50 p-4 dark:bg-white/5">
            <p className="mb-3 text-sm font-semibold text-neutral-950 dark:text-white">Contact</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input required placeholder="Name" value={form.customerName} onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))} className={field} />
              <input required type="email" placeholder="Email" value={form.customerEmail} onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))} className={field} />
              <input required placeholder="Phone" value={form.customerPhone} onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))} className={`${field} md:col-span-2`} />
            </div>
          </div>
          <label><span className={label}>Participant, if different</span><input placeholder="Participant name" value={form.participantName} onChange={(e) => setForm((prev) => ({ ...prev, participantName: e.target.value }))} className={field} /></label>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className={label}>Sessions bought</span><input type="number" min={1} value={form.sessionsPurchased} onChange={(e) => setForm((prev) => ({ ...prev, sessionsPurchased: Number(e.target.value) }))} className={field} /></label>
            <label><span className={label}>Sessions used</span><input type="number" min={0} value={form.sessionsUsed} onChange={(e) => setForm((prev) => ({ ...prev, sessionsUsed: Number(e.target.value) }))} className={field} /></label>
            <label><span className={label}>Price in cents</span><input type="number" min={0} value={form.priceCents} onChange={(e) => setForm((prev) => ({ ...prev, priceCents: Number(e.target.value) }))} className={field} /><p className="mt-1 text-xs text-neutral-400">2800 = SGD 28.00</p></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={label}>Valid until</span><StudioDate block clearable ariaLabel="Valid until" placeholder="No expiry" value={form.validUntil} onChange={(value) => setForm((prev) => ({ ...prev, validUntil: value }))} /></label>
            <label><span className={label}>Notes</span><textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={area} /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-950">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Saving…" : "Save record"}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} showCloseButton={false} className={sheet}>
        <form onSubmit={handleEdit} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Update record</h3>
            <button type="button" onClick={() => setEditModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-lg text-white" aria-label="Close">×</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={label}>Program</span><StudioMenu value={form.programType} onChange={(value) => setForm((prev) => ({ ...prev, programType: value }))} placeholder="Program" options={programOptions} /></label>
            <label><span className={label}>Package</span><input required value={form.packageLabel} onChange={(e) => setForm((prev) => ({ ...prev, packageLabel: e.target.value }))} className={field} /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label><span className={label}>Name</span><input required value={form.customerName} onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))} className={field} /></label>
            <label><span className={label}>Email</span><input required type="email" value={form.customerEmail} onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))} className={field} /></label>
            <label className="md:col-span-2"><span className={label}>Phone</span><input required value={form.customerPhone} onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))} className={field} /></label>
            <label className="md:col-span-2"><span className={label}>Participant</span><input value={form.participantName} onChange={(e) => setForm((prev) => ({ ...prev, participantName: e.target.value }))} className={field} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className={label}>Sessions bought</span><input type="number" min={1} value={form.sessionsPurchased} onChange={(e) => setForm((prev) => ({ ...prev, sessionsPurchased: Number(e.target.value) }))} className={field} /></label>
            <label><span className={label}>Sessions used</span><input type="number" min={0} value={form.sessionsUsed} onChange={(e) => setForm((prev) => ({ ...prev, sessionsUsed: Number(e.target.value) }))} className={field} /></label>
            <label><span className={label}>Price in cents</span><input type="number" min={0} value={form.priceCents} onChange={(e) => setForm((prev) => ({ ...prev, priceCents: Number(e.target.value) }))} className={field} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={label}>Payment</span><StudioMenu value={form.paymentStatus} onChange={(value) => setForm((prev) => ({ ...prev, paymentStatus: value }))} placeholder="Payment" options={paymentOptions} /></label>
            <label><span className={label}>Attendance</span><StudioMenu value={form.attendanceStatus} onChange={(value) => setForm((prev) => ({ ...prev, attendanceStatus: value }))} placeholder="Attendance" options={attendanceOptions} /></label>
            <label><span className={label}>Valid until</span><StudioDate block clearable ariaLabel="Valid until" placeholder="No expiry" value={form.validUntil} onChange={(value) => setForm((prev) => ({ ...prev, validUntil: value }))} /></label>
            <label><span className={label}>Notes</span><textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={area} /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditModalOpen(false)} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-950">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Updating…" : "Update record"}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={confirmPaidModalOpen} onClose={() => setConfirmPaidModalOpen(false)} showCloseButton={false} className="w-[min(420px,calc(100vw-2rem))] !rounded-[28px] p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Mark as paid</h3>
        <p className="mt-2 text-sm text-neutral-500">Mark the payment for {selectedRow?.customer_name} as paid.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmPaidModalOpen(false)} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-950">Cancel</button>
          <button type="button" onClick={async () => { if (selectedRow) { await updateRow(selectedRow.id, { markPaid: true }); setConfirmPaidModalOpen(false); } }} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950">Confirm</button>
        </div>
      </Modal>

      <Modal isOpen={confirmAttendanceModalOpen} onClose={() => setConfirmAttendanceModalOpen(false)} showCloseButton={false} className="w-[min(420px,calc(100vw-2rem))] !rounded-[28px] p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Add attendance</h3>
        <p className="mt-2 text-sm text-neutral-500">Add 1 session for {selectedRow?.customer_name}. Currently {selectedRow?.sessions_used}/{selectedRow?.sessions_purchased}.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmAttendanceModalOpen(false)} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-950">Cancel</button>
          <button
            type="button"
            onClick={async () => {
              if (!selectedRow) return;
              const newUsed = Math.min(selectedRow.sessions_purchased, selectedRow.sessions_used + 1);
              await updateRow(selectedRow.id, { sessionsUsed: newUsed, attendanceStatus: newUsed >= selectedRow.sessions_purchased ? "completed" : "in_progress" });
              setConfirmAttendanceModalOpen(false);
            }}
            className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Add session
          </button>
        </div>
      </Modal>

      <Modal isOpen={confirmDeleteModalOpen} onClose={() => setConfirmDeleteModalOpen(false)} showCloseButton={false} className="w-[min(420px,calc(100vw-2rem))] !rounded-[28px] p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Delete record</h3>
        <p className="mt-2 text-sm text-neutral-500">Delete the record for {selectedRow?.customer_name}. This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmDeleteModalOpen(false)} disabled={submitting} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => selectedRow && deleteRow(selectedRow.id)} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Deleting…" : "Delete"}</button>
        </div>
      </Modal>
    </div>
  );
}
