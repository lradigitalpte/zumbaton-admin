"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import DateRangePicker from "@/components/common/DateRangePicker";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { RefreshCw, Mail, Phone, User, Search, Trash2, CheckCircle, XCircle, Eye, Loader2, UserPlus, FileText, Send, Copy } from "lucide-react";
import { getWebAppUrl } from "@/lib/email-url";
import { InvoicePreviewModal, type PreviewInvoice } from "@/components/invoices/InvoicePreviewModal";
import Pagination from "@/components/tables/Pagination";
import { Modal } from "@/components/ui/modal";
import StudioDate from "@/components/ui/StudioDate";

interface TrialBooking {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestDateOfBirth: string | null;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  paymentId: string | null;
  class: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    location: string | null;
    instructorName: string | null;
    classType: string;
    ageGroup?: 'adult' | 'kid' | 'all' | null;
  } | null;
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
    hitpayPaymentRequestId?: string | null;
    metadata?: Record<string, any> | null;
  } | null;
}

const ITEMS_PER_PAGE = 20;

export default function TrialBookingsPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<TrialBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("all");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [deleteBookingName, setDeleteBookingName] = useState<string>("");
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<TrialBooking | null>(null);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [resendingInvoicePaymentId, setResendingInvoicePaymentId] = useState<string | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<PreviewInvoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Companion (2nd Guest) Modal State
  const [companionModalOpen, setCompanionModalOpen] = useState(false);
  const [companionBooking, setCompanionBooking] = useState<TrialBooking | null>(null);
  const [companionForm, setCompanionForm] = useState({
    guestName: "",
    guestPhone: "",
    guestDateOfBirth: "",
    guestEmail: "",
    gender: "female",
  });
  const [submittingCompanion, setSubmittingCompanion] = useState(false);

  const handleOpenCompanionModal = (booking: TrialBooking) => {
    setCompanionBooking(booking);
    const p2 = getParticipant2(booking);
    setCompanionForm({
      guestName: p2?.name || "",
      guestPhone: p2?.phone || "",
      guestDateOfBirth: p2?.dateOfBirth || "",
      guestEmail: p2?.email || "",
      gender: p2?.gender || "female",
    });
    setCompanionModalOpen(true);
  };

  const handleAddCompanionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionBooking) return;
    if (!companionForm.guestName.trim()) {
      showToast("Companion name is required", "error");
      return;
    }
    if (!companionForm.guestPhone.trim()) {
      showToast("Companion phone number is required", "error");
      return;
    }

    try {
      setSubmittingCompanion(true);
      const response = await api.post(`/api/trial-bookings/${companionBooking.id}/companion`, companionForm);
      if (response.error) {
        showToast(response.error?.message || "Failed to add 2nd guest", "error");
        return;
      }
      showToast("2nd guest (companion) added successfully!", "success");
      setCompanionModalOpen(false);
      setCompanionBooking(null);
      await fetchBookings();
      await fetchStats();
    } catch (error: any) {
      console.error("Error adding companion:", error);
      showToast(error.message || "Failed to add 2nd guest", "error");
    } finally {
      setSubmittingCompanion(false);
    }
  };

  // All-time bookings fetched once for monthly stats (not affected by filters)
  const [allBookingsForStats, setAllBookingsForStats] = useState<TrialBooking[]>([]);

  const fetchStats = async () => {
    try {
      const response = await api.get<{ success: boolean; data: TrialBooking[] }>(
        `/api/trial-bookings?page=1&pageSize=1000`
      );
      const payload = response.data as { data?: TrialBooking[] } | undefined;
      if (Array.isArray(payload?.data)) setAllBookingsForStats(payload.data);
    } catch {/* stats are non-critical */}
  };

  // Monthly breakdown computed from all bookings
  const monthlyStats = useMemo(() => {
    const byMonth: Record<string, { key: string; label: string; total: number; paid: number; draft: number; attended: number; needsScheduling: number }> = {};
    allBookingsForStats.forEach((b) => {
      const d = new Date(b.bookedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
      if (!byMonth[key]) byMonth[key] = { key, label, total: 0, paid: 0, draft: 0, attended: 0, needsScheduling: 0 };
      byMonth[key].total++;
      if (["succeeded", "completed"].includes(b.payment?.status || "") || ["confirmed", "attended", "needs_scheduling"].includes(b.status)) byMonth[key].paid++;
      if (b.status === "attended") byMonth[key].attended++;
      if (b.status === "draft") byMonth[key].draft++;
      if (b.status === "needs_scheduling") byMonth[key].needsScheduling++;
    });
    return Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key));
  }, [allBookingsForStats]);

  const currentMonthKey = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }).slice(0, 7);
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: ITEMS_PER_PAGE.toString(),
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      if (dateFrom) {
        params.set("startDate", new Date(dateFrom + "T00:00:00+08:00").toISOString());
      }
      if (dateTo) {
        params.set("endDate", new Date(dateTo + "T23:59:59.999+08:00").toISOString());
      }

      const response = await api.get<{ success: boolean; data: TrialBooking[]; pagination: { totalPages: number; total: number } }>(`/api/trial-bookings?${params.toString()}`);
      
      if (response.error) {
        showToast(response.error?.message || "Failed to fetch trial bookings", "error");
        return;
      }
      const payload = response.data as { success?: boolean; data?: TrialBooking[]; pagination?: { totalPages: number; total: number } } | undefined;
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setBookings(list);
      setTotalPages(payload?.pagination?.totalPages ?? 1);
      setTotal(payload?.pagination?.total ?? 0);

      // Keep selectedBooking updated with fresh data if modal is open
      setSelectedBooking((prev) => {
        if (!prev) return null;
        return list.find((b) => b.id === prev.id) || prev;
      });
    } catch (error: any) {
      console.error("Error fetching trial bookings:", error);
      showToast(error.message || "Failed to fetch trial bookings", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [currentPage, statusFilter, ageGroupFilter, dateFrom, dateTo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchBookings();
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-SG", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Singapore",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-SG", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Singapore",
    });
  };

  const formatDateTime = (dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-[#E4F56C]/50 text-neutral-950",
      confirmed: "bg-[#E4F56C] text-neutral-950",
      attended: "bg-neutral-950 text-white",
      cancelled: "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50",
      "cancelled-late": "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50",
      "no-show": "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50",
      needs_scheduling: "bg-neutral-950 text-[#E4F56C]",
      pending_payment: "border border-neutral-950 text-neutral-950 dark:border-white dark:text-white",
    };

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          styles[status as keyof typeof styles] || styles.confirmed
        }`}
      >
        {status === "draft" ? "⚠ Draft" : status === "needs_scheduling" ? "Paid · Needs class" : status === "pending_payment" ? "Awaiting payment" : status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
      </span>
    );
  };

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const isKidBooking = (booking: TrialBooking): boolean => {
    // Check class age_group first
    if (booking.class?.ageGroup === 'kid') return true;
    if (booking.class?.ageGroup === 'adult') return false;
    
    // Fallback to age calculation (under 13 is a kid)
    const age = calculateAge(booking.guestDateOfBirth);
    return age !== null && age < 13;
  };

  const getParticipant2 = (booking: TrialBooking) => {
    if (booking.payment?.metadata?.participant2) {
      const p2 = booking.payment.metadata.participant2;
      return {
        name: p2.name || "",
        phone: p2.phone || "",
        email: p2.email || "",
        dateOfBirth: p2.dateOfBirth || p2.guestDateOfBirth || null,
        gender: p2.gender || null,
      };
    }
    if (booking.cancellationReason && booking.cancellationReason.includes("Companion:")) {
      const namePhoneMatch = booking.cancellationReason.match(/Companion:\s*([^(|]+)(?:\(([^)]+)\))?/);
      const dobMatch = booking.cancellationReason.match(/DOB:\s*([^|]+)/);
      const genderMatch = booking.cancellationReason.match(/Gender:\s*([^|]+)/);
      if (namePhoneMatch) {
        const dobVal = dobMatch ? dobMatch[1].trim() : "";
        const genderVal = genderMatch ? genderMatch[1].trim() : "";
        return {
          name: namePhoneMatch[1].trim(),
          phone: namePhoneMatch[2]?.trim() || "",
          email: "",
          dateOfBirth: dobVal && dobVal !== "N/A" ? dobVal : null,
          gender: genderVal && genderVal !== "N/A" ? genderVal : null,
        };
      }
    }
    return null;
  };

  const isZumFamiliaBooking = (booking: TrialBooking): boolean =>
    booking.payment?.metadata?.flow_type === "zumfamilia";

  const isDuoTrialBooking = (booking: TrialBooking): boolean =>
    booking.payment?.metadata?.flow_type === "duo_trial" ||
    Boolean(getParticipant2(booking)) ||
    Boolean(booking.cancellationReason?.includes("DUO COMPANION"));

  type BookingType = 'trial' | 'duo-trial' | 'zumfamilia' | 'zumfiesta';
  const getBookingType = (booking: TrialBooking): BookingType => {
    const flow = booking.payment?.metadata?.flow_type;
    if (flow === 'zumfamilia') return 'zumfamilia';
    if (flow === 'duo_trial' || getParticipant2(booking) || booking.cancellationReason?.includes("DUO COMPANION")) return 'duo-trial';
    if (flow === 'zt_fiesta') return 'zumfiesta';
    return 'trial';
  };

  const BOOKING_TYPE_CONFIG: Record<BookingType, { label: string; badge: string }> = {
    trial: { label: "Trial", badge: "bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white" },
    "duo-trial": { label: "Duo Trial", badge: "bg-[#E4F56C] text-neutral-950" },
    zumfamilia: { label: "ZumFamilia", badge: "bg-neutral-950 text-[#E4F56C]" },
    zumfiesta: { label: "ZumFiesta", badge: "border border-neutral-950 text-neutral-950 dark:border-white dark:text-white" },
  };

  const getInitials = (name: string): string =>
    (name || "?").trim().split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

  const isPaymentPaid = (booking: TrialBooking): boolean =>
    booking.payment?.status === "succeeded" || booking.payment?.status === "completed";

  const getDisplayScheduleTime = (booking: TrialBooking): string =>
    (isZumFamiliaBooking(booking) ? booking.payment?.metadata?.custom_schedule : null) ||
    (booking.class?.scheduledAt ? formatDateTime(booking.class.scheduledAt) : "N/A");

  const getPrimaryContactName = (booking: TrialBooking): string =>
    (isZumFamiliaBooking(booking) ? booking.payment?.metadata?.parent_name : null) || booking.guestName;

  const getPrimaryContactEmail = (booking: TrialBooking): string =>
    (isZumFamiliaBooking(booking) ? booking.payment?.metadata?.parent_email : null) || booking.guestEmail;

  const getPrimaryContactPhone = (booking: TrialBooking): string | null =>
    (isZumFamiliaBooking(booking) ? booking.payment?.metadata?.parent_phone : null) || booking.guestPhone || null;

  const handleSyncPayment = async (booking: TrialBooking) => {
    // Pending-payment rows are virtual (no bookings row yet — id is "payment:<paymentId>"),
    // so they're re-checked against HitPay via the leads sync endpoint instead.
    const isVirtual = booking.id.startsWith("payment:");
    try {
      setSyncingPaymentId(booking.id);
      if (isVirtual) {
        if (!booking.paymentId) return;
        const response = await api.post<{ success?: boolean; data?: { status: string; changed: boolean; note?: string; hitpayStatus?: string }; error?: { message: string } }>(`/api/leads/${booking.paymentId}/sync`, {});
        if (response.error) {
          showToast(response.error.message || "Failed to sync payment", "error");
          return;
        }
        const result = response.data?.data;
        if (result?.status === "succeeded") {
          showToast(result.changed ? "Payment confirmed — now needs scheduling" : "Already confirmed paid", "success");
        } else if (result?.status === "failed") {
          showToast(result.note || "Not found on HitPay — marked as failed", "error");
        } else {
          showToast(`Still ${result?.hitpayStatus || "pending"} on HitPay — not paid yet`, "info");
        }
        await fetchBookings();
        return;
      }

      const response = await api.post<{ success?: boolean; synced?: boolean; message?: string }>(`/api/trial-bookings/${booking.id}/sync`, {});
      if (response.error) {
        showToast(response.error.message || "Failed to sync payment", "error");
        return;
      }
      const payload = response.data;
      showToast(payload?.message || "Payment sync completed", payload?.synced ? "success" : "info");
      await fetchBookings();
    } catch (error: any) {
      showToast(error.message || "Failed to sync payment", "error");
    } finally {
      setSyncingPaymentId(null);
    }
  };

  const handleCopyBookingLink = async (booking: TrialBooking) => {
    if (!booking.paymentId) return;
    const url = `${getWebAppUrl()}/start/pick-class?payment_id=${booking.paymentId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Booking link copied", "success");
    } catch {
      showToast(url, "info");
    }
  };

  const [sendingLinkPaymentId, setSendingLinkPaymentId] = useState<string | null>(null);
  const handleSendBookingLink = async (booking: TrialBooking) => {
    if (!booking.paymentId) return;
    try {
      setSendingLinkPaymentId(booking.paymentId);
      const response = await api.post<{ success?: boolean; data?: { companionEmailSent: boolean }; error?: { message: string } }>(`/api/leads/${booking.paymentId}/send-booking-link`, {});
      if (response.error) {
        showToast(response.error.message || "Failed to send booking link", "error");
        return;
      }
      showToast(`Booking link emailed to ${booking.guestName}${response.data?.data?.companionEmailSent ? " and their friend" : ""}`, "success");
    } catch (error: any) {
      showToast(error.message || "Failed to send booking link", "error");
    } finally {
      setSendingLinkPaymentId(null);
    }
  };

  const handleViewInvoice = async (booking: TrialBooking) => {
    const paymentId = booking.paymentId;
    if (!paymentId) return;

    setResendingInvoicePaymentId(paymentId);
    try {
      type InvoiceLookup = {
        id: string;
        invoiceNumber: string;
        description: string | null;
        totalCents?: number;
        amountCents?: number;
        currency: string;
        pdfUrl: string | null;
        guestName?: string | null;
        guestEmail?: string | null;
        billToName?: string | null;
        billToEmail?: string | null;
        originalAmountCents?: number | null;
        discountPercent?: number | null;
        discountAmountCents?: number | null;
      };

      const lookup = await api.get<{ data?: InvoiceLookup }>(`/api/payments/${paymentId}/invoice`);
      let invoiceData = lookup.data?.data;

      if (!invoiceData) {
        // No invoice yet — this payment predates the invoicing feature. Generate one now
        // (this does NOT email it — that only happens if "Send to Customer" is clicked).
        const generated = await api.post<{ data?: InvoiceLookup; error?: { message: string } }>(
          `/api/payments/${paymentId}/generate-invoice`,
          {}
        );
        if (generated.error || !generated.data?.data) {
          showToast(generated.error?.message || "Failed to generate invoice for this payment", "error");
          return;
        }
        invoiceData = generated.data.data;
      }

      setInvoicePreview({
        id: invoiceData.id,
        invoiceNumber: invoiceData.invoiceNumber,
        description: invoiceData.description,
        totalCents: invoiceData.totalCents ?? invoiceData.amountCents ?? 0,
        currency: invoiceData.currency,
        pdfUrl: invoiceData.pdfUrl,
        billToName: invoiceData.billToName ?? invoiceData.guestName,
        billToEmail: invoiceData.billToEmail ?? invoiceData.guestEmail,
        originalAmountCents: invoiceData.originalAmountCents,
        discountPercent: invoiceData.discountPercent,
        discountAmountCents: invoiceData.discountAmountCents,
      });
      setInvoicePreviewOpen(true);
    } catch (error: any) {
      showToast(error.message || "Failed to load invoice", "error");
    } finally {
      setResendingInvoicePaymentId(null);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string, reason?: string) => {
    try {
      setUpdatingStatus(bookingId);
      const response = await api.patch(`/api/trial-bookings/${bookingId}`, {
        status: newStatus,
        cancellationReason: reason,
      });

      if (response.error) {
        showToast(response.error?.message || "Failed to update status", "error");
        return;
      }

      showToast(`Status updated to ${newStatus}`, "success");
      // Refresh the bookings list to show updated status
      await fetchBookings();
    } catch (error: any) {
      console.error("Error updating status:", error);
      showToast(error.message || "Failed to update status", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteClick = (bookingId: string, guestName: string) => {
    setDeleteBookingId(bookingId);
    setDeleteBookingName(guestName);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteBookingId) return;

    try {
      setDeletingId(deleteBookingId);
      const response = await api.delete(`/api/trial-bookings/${deleteBookingId}`);

      if (response.error) {
        showToast(response.error?.message || "Failed to delete booking", "error");
        return;
      }

      showToast("Booking deleted successfully", "success");
      // Refresh the bookings list to remove deleted booking
      await fetchBookings();
      setDeleteModalOpen(false);
      setDeleteBookingId(null);
      setDeleteBookingName("");
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      showToast(error.message || "Failed to delete booking", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "pending_payment", label: "Awaiting payment" },
    { value: "draft", label: "Draft" },
    { value: "needs_scheduling", label: "Needs class" },
    { value: "confirmed", label: "Confirmed" },
    { value: "attended", label: "Attended" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no-show", label: "No show" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Trials{" "}
            <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
              <User className="h-3.5 w-3.5" />
            </span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            Paid trials, customers awaiting a class, and confirmed guest bookings in one place
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-4 rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-11 pr-4 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div className="lg:w-64">
            <DateRangePicker
              value={{ from: dateFrom, to: dateTo }}
              onChange={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }}
              placeholder="Date range (booked)"
              presets={["today", "week", "month", "clear"]}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status.value}
              type="button"
              onClick={() => { setStatusFilter(status.value); setCurrentPage(1); }}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                statusFilter === status.value
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All ages" },
            { value: "kid", label: "Kids" },
            { value: "adult", label: "Adults" },
          ].map((age) => (
            <button
              key={age.value}
              type="button"
              onClick={() => { setAgeGroupFilter(age.value); setCurrentPage(1); }}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                ageGroupFilter === age.value
                  ? "bg-[#E4F56C] text-neutral-950"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
              }`}
            >
              {age.label}
            </button>
          ))}
        </div>

        {/* Row 2: Booking type tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'trial', 'duo-trial', 'zumfamilia', 'zumfiesta'] as const).map((type) => {
            const isActive = bookingTypeFilter === type;
            const count = type === 'all' ? bookings.length : bookings.filter(b => getBookingType(b) === type).length;
            return (
              <button
                key={type}
                onClick={() => { setBookingTypeFilter(type); setCurrentPage(1); }}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${
                  isActive
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                {type === "all" ? "All types" : BOOKING_TYPE_CONFIG[type as BookingType].label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-[#E4F56C] text-neutral-950" : "bg-white text-neutral-500 dark:bg-neutral-950 dark:text-white/70"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Payment filter */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all', label: 'All Payments' },
            { key: 'paid', label: 'Paid' },
            { key: 'unpaid', label: 'Unpaid / Pending' },
          ] as const).map(({ key, label }) => {
            const isActive = paymentFilter === key;
            const count =
              key === 'all' ? bookings.length :
              key === 'paid' ? bookings.filter(isPaymentPaid).length :
              bookings.filter((b) => !isPaymentPaid(b)).length;
            return (
              <button
                key={key}
                onClick={() => { setPaymentFilter(key); setCurrentPage(1); }}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${
                  isActive
                    ? key === "paid"
                      ? "bg-[#E4F56C] text-neutral-950"
                      : "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? (key === "paid" ? "bg-neutral-950 text-[#E4F56C]" : "bg-[#E4F56C] text-neutral-950") : "bg-white text-neutral-500 dark:bg-neutral-950 dark:text-white/70"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Total</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{total}</div>
        </div>
        <button type="button" onClick={() => { setStatusFilter("pending_payment"); setCurrentPage(1); }} className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-left text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Awaiting payment</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#E4F56C]">{bookings.filter((b) => b.status === "pending_payment").length}</div>
          <div className="mt-1 text-[11px] text-white/45">From /start — not confirmed paid yet</div>
        </button>
        <button type="button" onClick={() => { setStatusFilter("needs_scheduling"); setCurrentPage(1); }} className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-left text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">Paid · Needs class</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{bookings.filter((b) => b.status === "needs_scheduling").length}</div>
          <div className="mt-1 text-[11px] text-neutral-950/60">Click to follow up</div>
        </button>
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Draft</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{bookings.filter((b) => b.status === "draft").length}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Needs follow-up</div>
        </div>
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Confirmed</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{bookings.filter((b) => b.status === "confirmed").length}</div>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Attended</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{bookings.filter((b) => b.status === "attended").length}</div>
        </div>
      </div>

      {/* Monthly Booking Stats */}
      {monthlyStats.length > 0 && (
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Bookings by month</h3>
            <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">all time · {allBookingsForStats.length}</span>
          </div>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:[grid-template-columns:repeat(var(--months),minmax(0,1fr))]"
            style={{ "--months": monthlyStats.length } as CSSProperties}
          >
            {monthlyStats.map((m) => {
              const isCurrentMonth = m.key === currentMonthKey;
              const peak = Math.max(...monthlyStats.map((month) => month.total), 1);
              const volume = Math.max(8, Math.round((m.total / peak) * 100));
              const shortMonth = new Date(`${m.key}-01T00:00:00`).toLocaleDateString("en-SG", { month: "short" });
              return (
                <div
                  key={m.key}
                  className={`flex min-h-[148px] min-w-0 flex-col rounded-[22px] p-3 ${
                    isCurrentMonth
                      ? "bg-[#E4F56C] text-neutral-950"
                      : "bg-neutral-50 dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[11px] font-semibold uppercase tracking-[0.12em] ${isCurrentMonth ? "text-neutral-950/60" : "text-neutral-400"}`}>
                      {shortMonth}{isCurrentMonth ? " · now" : ""}
                    </span>
                  </div>
                  <div className={`mt-2 text-3xl font-semibold leading-none tracking-tight ${isCurrentMonth ? "" : "text-neutral-950 dark:text-white"}`}>{m.total}</div>
                  <div className={`mt-auto h-1.5 overflow-hidden rounded-full ${isCurrentMonth ? "bg-neutral-950/15" : "bg-neutral-200 dark:bg-white/10"}`}>
                    <div className={`h-full rounded-full ${isCurrentMonth ? "bg-neutral-950" : "bg-[#E4F56C]"}`} style={{ width: `${volume}%` }} />
                  </div>
                  <p className={`mt-2 text-[11px] leading-snug ${isCurrentMonth ? "text-neutral-950/70" : "text-neutral-500"}`}>
                    {m.paid} paid
                    {m.attended > 0 ? ` · ${m.attended} att.` : ""}
                    {m.draft > 0 ? ` · ${m.draft} draft` : ""}
                    {m.needsScheduling > 0 ? ` · ${m.needsScheduling} need class` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bookings List */}
      {loading ? (
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-12 text-center dark:border-white/10 dark:bg-gray-800">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        </div>
      ) : !Array.isArray(bookings) || bookings.length === 0 ? (
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-12 text-center dark:border-white/10 dark:bg-gray-800">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">No bookings found</p>
          {searchQuery && <p className="mt-1 text-xs text-neutral-400">Try adjusting your search or filters</p>}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {bookings
              .filter((booking) => {
                // Awaiting-payment rows clutter the default view — hide them unless
                // staff explicitly filters to "Awaiting payment" (draft stays visible).
                if (statusFilter === "all" && booking.status === "pending_payment") return false;
                if (ageGroupFilter !== "all") {
                  const isKid = isKidBooking(booking);
                  if (ageGroupFilter === "kid" && !isKid) return false;
                  if (ageGroupFilter === "adult" && isKid) return false;
                }
                if (bookingTypeFilter !== "all" && getBookingType(booking) !== bookingTypeFilter) return false;
                if (paymentFilter === "paid" && !isPaymentPaid(booking)) return false;
                if (paymentFilter === "unpaid" && isPaymentPaid(booking)) return false;
                return true;
              })
              .map((booking) => {
                const type = getBookingType(booking);
                const config = BOOKING_TYPE_CONFIG[type];
                const isDraft = booking.status === "draft";
                const isUnscheduled = booking.status === "needs_scheduling";
                const isPendingPayment = booking.status === "pending_payment";
                const isKid = isKidBooking(booking);
                const isZumFamilia = type === "zumfamilia";
                const primaryName = getPrimaryContactName(booking);
                const primaryEmail = getPrimaryContactEmail(booking);
                const primaryPhone = getPrimaryContactPhone(booking);
                const p2 = getParticipant2(booking);
                const isBusy = updatingStatus === booking.id || deletingId === booking.id || syncingPaymentId === booking.id || (!!booking.paymentId && sendingLinkPaymentId === booking.paymentId);

                return (
                  <div
                    key={booking.id}
                    className={`relative min-w-0 rounded-[28px] border bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:bg-gray-800 sm:p-5 ${
                      openDropdownId === booking.id ? "z-50" : ""
                    } ${
                      isDraft ? "border-[#d5e45c]" :
                      isUnscheduled ? "border-neutral-950 dark:border-[#E4F56C]" :
                      isPendingPayment ? "border-neutral-950/40" :
                      "border-neutral-200/80 dark:border-white/10"
                    }`}
                  >
                    <div className="grid w-full min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,200px)] lg:gap-4 lg:pr-[120px]">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                          {getInitials(primaryName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.badge}`}>{config.label}</span>
                            {getStatusBadge(booking.status)}
                            {isKid && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-950 dark:bg-white/10 dark:text-white">{isZumFamilia ? "Child" : "Kid"}</span>}
                          </div>
                          <p className="mt-2 truncate text-lg font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{primaryName}</p>
                          <p className="truncate text-sm text-neutral-500 dark:text-white/50">{primaryEmail}</p>
                          <p className="text-sm text-neutral-500 dark:text-white/50">
                            {primaryPhone}
                            {booking.guestDateOfBirth ? ` · Age ${calculateAge(booking.guestDateOfBirth)}` : ""}
                          </p>
                          {isZumFamilia && <p className="mt-1 text-xs font-semibold text-neutral-950 dark:text-white">Child: {booking.guestName}{booking.guestDateOfBirth ? ` (${calculateAge(booking.guestDateOfBirth)} yrs)` : ""}</p>}
                          {p2 && (
                            <p className="mt-2 max-w-full rounded-2xl bg-[#E4F56C]/50 px-3 py-1 text-xs font-semibold leading-snug text-neutral-950">
                              2nd guest: {p2.name || "—"}{p2.phone ? ` · ${p2.phone}` : ""}
                              {p2.dateOfBirth ? ` · Age ${calculateAge(p2.dateOfBirth)}` : ""}
                              {p2.gender ? ` · ${p2.gender.charAt(0).toUpperCase() + p2.gender.slice(1)}` : ""}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400">Booked {formatDate(booking.bookedAt)}</p>
                        </div>
                      </div>

                      <div className="flex h-full min-w-0 flex-col justify-center rounded-[22px] bg-neutral-50 px-4 py-3 dark:bg-white/5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Class</p>
                          {booking.class ? (
                            <>
                              <p className="mt-1 truncate font-semibold uppercase leading-tight text-neutral-950 dark:text-white">{booking.class.title}</p>
                              {booking.class.instructorName && <p className="truncate text-sm text-neutral-500">{booking.class.instructorName}</p>}
                              {isZumFamilia && booking.payment?.metadata?.package_label && (
                                <p className="text-xs font-semibold text-neutral-950 dark:text-white">{booking.payment.metadata.package_label}</p>
                              )}
                              <p className="mt-1 text-sm leading-snug text-neutral-950 dark:text-white">{getDisplayScheduleTime(booking)}</p>
                            </>
                          ) : isUnscheduled ? (
                            <div className="mt-1"><p className="font-semibold text-neutral-950 dark:text-white">Class not selected</p><p className="text-xs text-neutral-500">Staff follow-up required</p></div>
                          ) : isPendingPayment ? (
                            <div className="mt-1"><p className="font-semibold text-neutral-950 dark:text-white">Awaiting payment</p><p className="text-xs text-neutral-500">Not confirmed on HitPay yet</p></div>
                          ) : <span className="text-sm text-neutral-400">—</span>}
                        </div>
                      <div className="flex h-full min-w-0 flex-col justify-center rounded-[22px] bg-neutral-950 px-4 py-3 text-white">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Payment</p>
                          {booking.payment ? (
                            <>
                              <p className="mt-1 text-xl font-semibold tracking-tight">{booking.payment.currency} {(booking.payment.amountCents / 100).toFixed(2)}</p>
                              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPaymentPaid(booking) ? "bg-[#E4F56C] text-neutral-950" : "bg-white/15 text-white"}`}>{booking.payment.status}</span>
                            </>
                          ) : (
                            <p className="mt-2 text-sm text-white/50">No payment</p>
                          )}
                      </div>

                      <div className="flex items-center justify-end lg:absolute lg:right-5 lg:top-5 lg:w-[104px]">
                        <div className="relative flex w-full flex-col items-stretch gap-2">
                          {isUnscheduled && (
                            <a href={`/leads?search=${encodeURIComponent(primaryEmail || primaryPhone || primaryName)}`} className="inline-flex justify-center rounded-full bg-[#E4F56C] px-2 py-2 text-center text-[11px] font-semibold leading-tight text-neutral-950 hover:bg-[#d5e45c]">
                              Schedule in Leads
                            </a>
                          )}
                          {isPendingPayment && (
                            <button
                              onClick={() => handleSyncPayment(booking)}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-950 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                              title="Re-check this payment against HitPay"
                            >
                              {syncingPaymentId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Sync payment
                            </button>
                          )}
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === booking.id ? null : booking.id)}
                            disabled={isBusy}
                            className="flex w-full items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
                          >
                            {isBusy
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><span>Actions</span><span className="text-gray-400">▾</span></>
                            }
                          </button>

                          {openDropdownId === booking.id && (
                            <>
                              {/* backdrop to close */}
                              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[22px] border border-neutral-200/80 bg-white p-1.5 shadow-[0_18px_50px_rgba(16,24,40,0.16)] dark:border-white/10 dark:bg-neutral-950">
                                {/* View */}
                                <button onClick={() => { setSelectedBooking(booking); setDetailsModalOpen(true); setOpenDropdownId(null); }}
                                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                  <Eye className="w-3.5 h-3.5 text-gray-500" /> View Details
                                </button>

                                {/* Add 2nd Guest / Companion — needs a real booking row, not a virtual one */}
                                {!isUnscheduled && !isPendingPayment && (
                                  <button onClick={() => { handleOpenCompanionModal(booking); setOpenDropdownId(null); }}
                                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#E4F56C] dark:text-white dark:hover:bg-[#E4F56C] dark:hover:text-neutral-950">
                                    <UserPlus className="w-3.5 h-3.5" /> + Add 2nd Guest
                                  </button>
                                )}

                                {isUnscheduled && booking.paymentId && (
                                  <>
                                    <button
                                      onClick={() => { handleSendBookingLink(booking); setOpenDropdownId(null); }}
                                      disabled={sendingLinkPaymentId === booking.paymentId}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 disabled:opacity-50 dark:text-white dark:hover:bg-white/10">
                                      {sendingLinkPaymentId === booking.paymentId
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Send className="w-3.5 h-3.5" />}
                                      Send booking link
                                    </button>
                                    <button
                                      onClick={() => { handleCopyBookingLink(booking); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                      <Copy className="w-3.5 h-3.5" />
                                      Copy booking link
                                    </button>
                                  </>
                                )}

                                {booking.payment?.status === "succeeded" && booking.paymentId && (
                                  <button
                                    onClick={() => { handleViewInvoice(booking); setOpenDropdownId(null); }}
                                    disabled={resendingInvoicePaymentId === booking.paymentId}
                                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10 disabled:opacity-50">
                                    {resendingInvoicePaymentId === booking.paymentId
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <FileText className="w-3.5 h-3.5 text-emerald-600" />}
                                    View Invoice
                                  </button>
                                )}

                                {isDraft && (
                                  <>
                                    <a href={`mailto:${primaryEmail}?subject=Complete Your Booking&body=Hi ${primaryName},%0D%0A%0D%0AWe noticed your booking wasn't completed. We'd love to help!%0D%0A%0D%0AThank you!`}
                                      onClick={() => setOpenDropdownId(null)}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                      <Mail className="w-3.5 h-3.5 text-green-600" /> Email Guest
                                    </a>
                                    {primaryPhone && (
                                      <a href={`tel:${primaryPhone}`} onClick={() => setOpenDropdownId(null)}
                                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                        <Phone className="w-3.5 h-3.5 text-blue-600" /> Call Guest
                                      </a>
                                    )}
                                    {booking.payment?.hitpayPaymentRequestId && (
                                      <button onClick={() => { handleSyncPayment(booking); setOpenDropdownId(null); }}
                                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                        <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Sync Payment
                                      </button>
                                    )}
                                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                    <button onClick={() => { handleStatusUpdate(booking.id, "confirmed"); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#E4F56C] dark:text-white dark:hover:bg-[#E4F56C] dark:hover:text-neutral-950">
                                      <CheckCircle className="w-3.5 h-3.5" /> Confirm Booking
                                    </button>
                                    <button onClick={() => { setCancelBookingId(booking.id); setCancelReason(""); setCancelModalOpen(true); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                      <XCircle className="w-3.5 h-3.5" /> Cancel
                                    </button>
                                    <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}

                                {booking.status === "confirmed" && (
                                  <>
                                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                    <button onClick={() => { handleStatusUpdate(booking.id, "attended"); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#E4F56C] dark:text-white dark:hover:bg-[#E4F56C] dark:hover:text-neutral-950">
                                      <CheckCircle className="w-3.5 h-3.5" /> Mark Attended
                                    </button>
                                    <button onClick={() => { handleStatusUpdate(booking.id, "no-show"); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10">
                                      <XCircle className="w-3.5 h-3.5" /> No Show
                                    </button>
                                    <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}

                                {(booking.status === "cancelled" || booking.status === "cancelled-late" || booking.status === "no-show") && (
                                  <>
                                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                    <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-[28px] border border-neutral-200/80 bg-white px-5 py-4 dark:border-white/10 dark:bg-gray-800">
            <p className="text-sm text-neutral-500">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, total)}–{Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} booking{total !== 1 ? "s" : ""}
            </p>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        </>
      )}

      {/* Booking Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedBooking(null);
        }}
        className="my-auto w-[min(860px,calc(100vw-2rem))] max-h-[calc(100vh-2.5rem)] overflow-y-auto !rounded-[28px] !border-neutral-200/80"
      >
        <div className="p-5 sm:p-6">
          <h4 className="mb-4 pr-10 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Booking Details
          </h4>
          {selectedBooking && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  ["Flow", isDuoTrialBooking(selectedBooking) ? "Duo Trial (1-for-1)" : isZumFamiliaBooking(selectedBooking) ? "ZumFamilia" : "Trial Booking", false],
                  ["Status", selectedBooking.status, false],
                  ["Primary Contact", getPrimaryContactName(selectedBooking), false],
                  ["Primary Email", getPrimaryContactEmail(selectedBooking), false],
                  ["Primary Phone", getPrimaryContactPhone(selectedBooking) || "N/A", false],
                  [isKidBooking(selectedBooking) ? "Child Name" : "Guest Name", selectedBooking.guestName, false],
                  ["Date of Birth", selectedBooking.guestDateOfBirth || "N/A", false],
                  ["Class", selectedBooking.class?.title || "N/A", false],
                  ["Class Time", getDisplayScheduleTime(selectedBooking), true],
                  ["Booked On", selectedBooking.bookedAt ? formatDateTime(selectedBooking.bookedAt) : "N/A", true],
                  ["Payment", selectedBooking.payment ? `${(selectedBooking.payment.amountCents / 100).toFixed(2)} ${selectedBooking.payment.currency}` : "No payment", false],
                  ["Payment Status", selectedBooking.payment?.status || "N/A", false],
                ].map(([label, value, wide]) => (
                  <div key={String(label)} className={`min-w-0 rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-white/5 ${wide ? "col-span-2" : ""}`}>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">{label}</p>
                    <p className="mt-0.5 break-words font-medium text-neutral-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* 2nd Guest (Companion) Box */}
              {(() => {
                const bookingP2 = selectedBooking ? getParticipant2(selectedBooking) : null;
                if (bookingP2) {
                  return (
                    <div className="space-y-2 rounded-[22px] bg-[#E4F56C] px-4 py-3 text-neutral-950">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
                        <span className="flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> 2nd Guest</span>
                        <span className="shrink-0 rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] text-[#E4F56C]">Attached</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-4">
                        <div><span className="font-semibold text-gray-900 dark:text-white">Companion Name:</span> {bookingP2.name}</div>
                        <div><span className="font-semibold text-gray-900 dark:text-white">Companion Phone:</span> {bookingP2.phone || "N/A"}</div>
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">Age:</span>{" "}
                          {bookingP2.dateOfBirth && bookingP2.dateOfBirth !== "N/A" ? `${calculateAge(bookingP2.dateOfBirth)} yrs (${bookingP2.dateOfBirth})` : "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">Gender:</span>{" "}
                          {bookingP2.gender && bookingP2.gender !== "N/A" ? bookingP2.gender.charAt(0).toUpperCase() + bookingP2.gender.slice(1).replace('_', ' ') : "N/A"}
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <span className="font-semibold text-gray-900 dark:text-white">Companion Email:</span> {bookingP2.email || "N/A"}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {selectedBooking.cancellationReason && (
                <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <span>Waiver / Booking Notes</span>
                    {/PENDING/.test(selectedBooking.cancellationReason) ? (
                      <span className="rounded-full bg-[#E4F56C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-950">
                        Not signed yet
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Signed
                      </span>
                    )}
                  </div>
                  <p className="break-words text-xs text-white/80">{selectedBooking.cancellationReason}</p>
                  {/PENDING/.test(selectedBooking.cancellationReason) && (
                    <p className="mt-2 text-xs text-[#E4F56C]">
                      Guest agreed to the waiver before paying but hasn&apos;t completed NRIC + signature. Collect this at check-in.
                    </p>
                  )}
                </div>
              )}

              {isZumFamiliaBooking(selectedBooking) && (
                <div className="rounded-[22px] bg-neutral-50 p-4 dark:bg-white/5">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">ZumFamilia Extras</div>
                  <div><span className="font-medium">Package:</span> {selectedBooking.payment?.metadata?.package_label || selectedBooking.payment?.metadata?.package_option || "N/A"}</div>
                  <div><span className="font-medium">Custom Schedule:</span> {selectedBooking.payment?.metadata?.custom_schedule || "N/A"}</div>
                  <div><span className="font-medium">Notes:</span> {selectedBooking.payment?.metadata?.notes || "N/A"}</div>
                </div>
              )}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]"
              onClick={() => {
                setDetailsModalOpen(false);
                if (selectedBooking) handleOpenCompanionModal(selectedBooking);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add / Edit 2nd Guest
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
              onClick={() => {
                setDetailsModalOpen(false);
                setSelectedBooking(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason("");
          setCancelBookingId(null);
        }}
        className="max-w-[480px] w-full !rounded-[28px] !border-neutral-200/80"
      >
        <div className="p-6">
          <h4 className="mb-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Cancel Booking
          </h4>
          <p className="mb-4 text-sm text-neutral-500">
            Add a reason for cancelling so you can track follow-up.
          </p>

          <div className="mb-6">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Cancellation reason
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Called - not interested, Emailed - no response..."
              className="w-full resize-none rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason("");
                setCancelBookingId(null);
              }}
            >
              Keep booking
            </button>
            <button
              type="button"
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => {
                if (cancelBookingId) {
                  handleStatusUpdate(
                    cancelBookingId,
                    "cancelled",
                    cancelReason.trim() || "Followed up - no reason provided"
                  );
                  setCancelModalOpen(false);
                  setCancelReason("");
                  setCancelBookingId(null);
                }
              }}
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteBookingId(null);
          setDeleteBookingName("");
        }}
        className="max-w-[420px] w-full !rounded-[28px] !border-neutral-200/80"
      >
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-[#E4F56C]">
            <Trash2 className="h-5 w-5" />
          </div>
          <h4 className="mb-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Delete Booking
          </h4>
          <p className="mb-6 text-sm leading-relaxed text-neutral-500">
            Delete the booking for <strong className="text-neutral-950 dark:text-white">{deleteBookingName}</strong>? This cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteBookingId(null);
                setDeleteBookingName("");
              }}
            >
              Keep booking
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingId ? "Deleting..." : "Delete Booking"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Companion (2nd Guest) Modal */}
      <Modal
        isOpen={companionModalOpen}
        onClose={() => {
          setCompanionModalOpen(false);
          setCompanionBooking(null);
        }}
        className="max-w-[500px] w-full !rounded-[28px] !border-neutral-200/80"
      >
        <form onSubmit={handleAddCompanionSubmit} className="p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4F56C] text-neutral-950">
              <UserPlus className="h-4 w-4" />
            </span>
            <h4 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Add 2nd Guest
            </h4>
          </div>
          <p className="mb-4 text-sm text-neutral-500">
            Attaching a 2nd participant for <strong>{companionBooking?.guestName}</strong>&apos;s booking on{" "}
            <strong>{companionBooking?.class?.title || "Class"}</strong>.
          </p>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Companion Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Tan"
                value={companionForm.guestName}
                onChange={(e) => setCompanionForm({ ...companionForm, guestName: e.target.value })}
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Companion Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 91234567"
                value={companionForm.guestPhone}
                onChange={(e) => setCompanionForm({ ...companionForm, guestPhone: e.target.value })}
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date of Birth
                </label>
                <StudioDate
                  block
                  clearable
                  ariaLabel="Date of birth"
                  placeholder="Date of birth"
                  value={companionForm.guestDateOfBirth}
                  onChange={(value) => setCompanionForm({ ...companionForm, guestDateOfBirth: value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                    { value: "other", label: "Other" },
                    { value: "prefer_not_to_say", label: "Prefer not to say" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCompanionForm({ ...companionForm, gender: option.value })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        companionForm.gender === option.value
                          ? "bg-neutral-950 text-white"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Companion Email (Optional)
              </label>
              <input
                type="email"
                placeholder="e.g. companion@email.com (optional)"
                value={companionForm.guestEmail}
                onChange={(e) => setCompanionForm({ ...companionForm, guestEmail: e.target.value })}
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                If left blank, a guest placeholder email will be auto-generated.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
              onClick={() => {
                setCompanionModalOpen(false);
                setCompanionBooking(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCompanion}
              className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {submittingCompanion ? "Saving..." : "Add Companion"}
            </button>
          </div>
        </form>
      </Modal>

      <InvoicePreviewModal
        isOpen={invoicePreviewOpen}
        onClose={() => setInvoicePreviewOpen(false)}
        invoice={invoicePreview}
      />
    </div>
  );
}
