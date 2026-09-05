"use client";

import { useState, useEffect, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import DateRangePicker from "@/components/common/DateRangePicker";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { RefreshCw, Mail, Phone, User, Search, Trash2, CheckCircle, XCircle, Eye, Loader2, UserPlus } from "lucide-react";
import Pagination from "@/components/tables/Pagination";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

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
    const byMonth: Record<string, { key: string; label: string; total: number; paid: number; draft: number; attended: number }> = {};
    allBookingsForStats.forEach((b) => {
      const d = new Date(b.bookedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
      if (!byMonth[key]) byMonth[key] = { key, label, total: 0, paid: 0, draft: 0, attended: 0 };
      byMonth[key].total++;
      if (b.status === "confirmed") byMonth[key].paid++;
      if (b.status === "attended") { byMonth[key].paid++; byMonth[key].attended++; }
      if (b.status === "draft") byMonth[key].draft++;
    });
    return Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key));
  }, [allBookingsForStats]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
        params.set("startDate", new Date(dateFrom + "T00:00:00.000Z").toISOString());
      }
      if (dateTo) {
        params.set("endDate", new Date(dateTo + "T23:59:59.999Z").toISOString());
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
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-SG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-2 border-yellow-300 dark:border-yellow-700",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      attended: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      "cancelled-late": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      "no-show": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      needs_scheduling: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles] || styles.confirmed
        }`}
      >
        {status === "draft" ? "⚠ Draft" : status === "needs_scheduling" ? "Paid · Needs class" : status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
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

  const BOOKING_TYPE_CONFIG: Record<BookingType, { label: string; badge: string; rowBorder: string }> = {
    'trial':      { label: 'Trial',      badge: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',       rowBorder: 'border-l-4 border-blue-400' },
    'duo-trial':  { label: 'Duo Trial',  badge: 'bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-900/30 dark:text-lime-400 dark:border-lime-700',         rowBorder: 'border-l-4 border-lime-500' },
    'zumfamilia': { label: 'ZumFamilia', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700', rowBorder: 'border-l-4 border-emerald-500' },
    'zumfiesta':  { label: 'ZumFiesta',  badge: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',  rowBorder: 'border-l-4 border-orange-500' },
  };

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
    try {
      setSyncingPaymentId(booking.id);
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

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Trial Bookings" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Guest Bookings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Trials · Duo Trials · ZumFamilia · ZumFiesta — all guest bookings in one place
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        {/* Row 1: Search + Status + Age + Date */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="sm:w-44 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="needs_scheduling">Paid · Needs class</option>
            <option value="confirmed">Confirmed</option>
            <option value="attended">Attended</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
          <select
            value={ageGroupFilter}
            onChange={(e) => { setAgeGroupFilter(e.target.value); setCurrentPage(1); }}
            className="sm:w-36 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          >
            <option value="all">All Ages</option>
            <option value="kid">Kids</option>
            <option value="adult">Adults</option>
          </select>
          <div className="sm:min-w-[200px]">
            <DateRangePicker
              value={{ from: dateFrom, to: dateTo }}
              onChange={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }}
              placeholder="Date range (booked)"
              presets={["today", "week", "month", "clear"]}
              className="w-full"
            />
          </div>
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                {type === 'all' ? 'All Types' : BOOKING_TYPE_CONFIG[type as BookingType].label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{total}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
          <div className="text-xs text-yellow-600 dark:text-yellow-400 uppercase tracking-wide font-medium">Draft ⚠️</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {bookings.filter((b) => b.status === "draft").length}
          </div>
          <div className="text-[10px] text-yellow-500 mt-0.5">Needs follow-up</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Confirmed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {bookings.filter((b) => b.status === "confirmed").length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Attended</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {bookings.filter((b) => b.status === "attended").length}
          </div>
        </div>
      </div>

      {/* Monthly Booking Stats */}
      {monthlyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Bookings by Month</h3>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">all time · {allBookingsForStats.length} total</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {monthlyStats.map((m) => {
              const isCurrentMonth = m.key === currentMonthKey;
              const maxTotal = Math.max(...monthlyStats.map((x) => x.total), 1);
              const paidPct = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
              return (
                <div
                  key={m.key}
                  className={`shrink-0 w-28 rounded-lg border p-3 ${
                    isCurrentMonth
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isCurrentMonth ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {m.label}{isCurrentMonth && " ·now"}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none mb-1.5">{m.total}</div>
                  {/* Stacked bar */}
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2">
                    <div className="h-full flex">
                      <div className="h-full bg-green-500 transition-all" style={{ width: `${paidPct}%` }} />
                      <div className="h-full bg-yellow-400 transition-all" style={{ width: `${m.total > 0 ? Math.round((m.draft / m.total) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-green-600 dark:text-green-400 font-semibold">✓ {m.paid} paid</span>
                      {m.attended > 0 && <span className="text-[9px] text-blue-500 font-semibold">{m.attended} att.</span>}
                    </div>
                    {m.draft > 0 && <span className="text-[9px] text-yellow-600 dark:text-yellow-400 font-semibold">⚠ {m.draft} draft</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-amber-500 mx-auto" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        ) : !Array.isArray(bookings) || bookings.length === 0 ? (
          <div className="p-10 text-center">
            <User className="w-9 h-9 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No bookings found</p>
            {searchQuery && <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold w-[38%]">Guest</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-[32%]">Class &amp; Time</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-[16%]">Payment</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-[14%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bookings
                    .filter((booking) => {
                      if (ageGroupFilter !== "all") {
                        const isKid = isKidBooking(booking);
                        if (ageGroupFilter === "kid" && !isKid) return false;
                        if (ageGroupFilter === "adult" && isKid) return false;
                      }
                      if (bookingTypeFilter !== "all" && getBookingType(booking) !== bookingTypeFilter) return false;
                      return true;
                    })
                    .map((booking) => {
                      const type = getBookingType(booking);
                      const config = BOOKING_TYPE_CONFIG[type];
                      const isDraft = booking.status === "draft";
                      const isUnscheduled = booking.status === "needs_scheduling";
                      const isKid = isKidBooking(booking);
                      const isZumFamilia = type === "zumfamilia";
                      const isDuo = type === "duo-trial";
                      const primaryName = getPrimaryContactName(booking);
                      const primaryEmail = getPrimaryContactEmail(booking);
                      const primaryPhone = getPrimaryContactPhone(booking);
                      const p2 = getParticipant2(booking);
                      const isBusy = updatingStatus === booking.id || deletingId === booking.id || syncingPaymentId === booking.id;

                      return (
                        <tr
                          key={booking.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 align-top ${config.rowBorder} ${isDraft ? "bg-yellow-50/40 dark:bg-yellow-900/10" : ""}`}
                        >
                          {/* Guest — name, badges, contact, secondary info */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border leading-none ${config.badge}`}>{config.label}</span>
                              {getStatusBadge(booking.status)}
                              {isKid && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700 leading-none">{isZumFamilia ? "Child" : "Kid"}</span>}
                            </div>
                            <p className="font-semibold text-gray-900 dark:text-white leading-tight">{primaryName}</p>
                            <p className="text-gray-400 dark:text-gray-500 truncate">{primaryEmail}</p>
                            <p className="text-gray-400 dark:text-gray-500">
                              {primaryPhone && <span>{primaryPhone}</span>}
                              {booking.guestDateOfBirth && <span className="ml-1.5">· Age {calculateAge(booking.guestDateOfBirth)}</span>}
                            </p>
                            {isZumFamilia && <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 text-[10px]">Child: {booking.guestName}{booking.guestDateOfBirth ? ` (${calculateAge(booking.guestDateOfBirth)} yrs)` : ""}</p>}
                            {p2 && (
                              <p className="text-lime-600 dark:text-lime-400 font-bold mt-0.5 text-[10px]">
                                P2 (2nd Guest): {p2.name || "—"}{p2.phone ? ` · ${p2.phone}` : ""}
                                {p2.dateOfBirth ? ` · Age ${calculateAge(p2.dateOfBirth)}` : ""}
                                {p2.gender ? ` · ${p2.gender.charAt(0).toUpperCase() + p2.gender.slice(1)}` : ""}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">Booked {formatDate(booking.bookedAt)}</p>
                          </td>

                          {/* Class & Time — merged */}
                          <td className="px-4 py-3">
                            {booking.class ? (
                              <>
                                <p className="font-semibold text-gray-900 dark:text-white uppercase leading-tight">{booking.class.title}</p>
                                {booking.class.instructorName && <p className="text-gray-400 dark:text-gray-500">{booking.class.instructorName}</p>}
                                {isZumFamilia && booking.payment?.metadata?.package_label && (
                                  <p className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">{booking.payment.metadata.package_label}</p>
                                )}
                                <p className="text-gray-600 dark:text-gray-300 mt-0.5">{getDisplayScheduleTime(booking)}</p>
                              </>
                            ) : (
                              isUnscheduled ? (
                                <div><p className="font-bold text-amber-700 dark:text-amber-300">Class not selected</p><p className="text-xs text-amber-600">Staff follow-up required</p></div>
                              ) : <span className="text-gray-400 italic">—</span>
                            )}
                          </td>

                          {/* Payment */}
                          <td className="px-4 py-3">
                            {booking.payment ? (
                              <>
                                <p className="font-semibold text-gray-900 dark:text-white">{booking.payment.currency} {(booking.payment.amountCents / 100).toFixed(2)}</p>
                                <p className={`text-[10px] ${booking.payment.status === "succeeded" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>{booking.payment.status}</p>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Actions — dropdown */}
                          <td className="px-4 py-3">
                            <div className="relative">
                              {isUnscheduled && (
                                <a href={`/leads?search=${encodeURIComponent(primaryEmail || primaryPhone || primaryName)}`} className="inline-flex rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">
                                  Schedule in Leads
                                </a>
                              )}
                              <button
                                onClick={() => setOpenDropdownId(openDropdownId === booking.id ? null : booking.id)}
                                disabled={isBusy || isUnscheduled}
                                className={`${isUnscheduled ? "hidden" : "flex"} items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50`}
                              >
                                {isBusy
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <><span>Actions</span><span className="text-gray-400">▾</span></>
                                }
                              </button>

                              {openDropdownId === booking.id && (
                                <>
                                  {/* backdrop to close */}
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                                  <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
                                    {/* View */}
                                    <button onClick={() => { setSelectedBooking(booking); setDetailsModalOpen(true); setOpenDropdownId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                      <Eye className="w-3.5 h-3.5 text-gray-500" /> View Details
                                    </button>

                                    {/* Add 2nd Guest / Companion */}
                                    <button onClick={() => { handleOpenCompanionModal(booking); setOpenDropdownId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-lime-700 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors font-semibold border-t border-b border-gray-100 dark:border-gray-800">
                                      <UserPlus className="w-3.5 h-3.5" /> + Add 2nd Guest
                                    </button>

                                    {isDraft && (
                                      <>
                                        <a href={`mailto:${primaryEmail}?subject=Complete Your Booking&body=Hi ${primaryName},%0D%0A%0D%0AWe noticed your booking wasn't completed. We'd love to help!%0D%0A%0D%0AThank you!`}
                                          onClick={() => setOpenDropdownId(null)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                          <Mail className="w-3.5 h-3.5 text-green-600" /> Email Guest
                                        </a>
                                        {primaryPhone && (
                                          <a href={`tel:${primaryPhone}`} onClick={() => setOpenDropdownId(null)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                            <Phone className="w-3.5 h-3.5 text-blue-600" /> Call Guest
                                          </a>
                                        )}
                                        {booking.payment?.hitpayPaymentRequestId && (
                                          <button onClick={() => { handleSyncPayment(booking); setOpenDropdownId(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Sync Payment
                                          </button>
                                        )}
                                        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                        <button onClick={() => { handleStatusUpdate(booking.id, "confirmed"); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-semibold">
                                          <CheckCircle className="w-3.5 h-3.5" /> Confirm Booking
                                        </button>
                                        <button onClick={() => { setCancelBookingId(booking.id); setCancelReason(""); setCancelModalOpen(true); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                                          <XCircle className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                        <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                          <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                      </>
                                    )}

                                    {booking.status === "confirmed" && (
                                      <>
                                        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                        <button onClick={() => { handleStatusUpdate(booking.id, "attended"); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-semibold">
                                          <CheckCircle className="w-3.5 h-3.5" /> Mark Attended
                                        </button>
                                        <button onClick={() => { handleStatusUpdate(booking.id, "no-show"); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                          <XCircle className="w-3.5 h-3.5" /> No Show
                                        </button>
                                        <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                          <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                      </>
                                    )}

                                    {(booking.status === "cancelled" || booking.status === "cancelled-late" || booking.status === "no-show") && (
                                      <>
                                        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                        <button onClick={() => { handleDeleteClick(booking.id, booking.guestName); setOpenDropdownId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                          <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, total)}–{Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} booking{total !== 1 ? "s" : ""}
              </p>
              {totalPages > 1 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Booking Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedBooking(null);
        }}
        className="max-w-[640px] w-full"
      >
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Booking Details
          </h4>
          {selectedBooking && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><span className="font-medium">Flow:</span>{" "}
                  {isDuoTrialBooking(selectedBooking)
                    ? "Duo Trial (1-for-1)"
                    : isZumFamiliaBooking(selectedBooking)
                      ? "ZumFamilia"
                      : "Trial Booking"}
                </div>
                <div><span className="font-medium">Status:</span> {selectedBooking.status}</div>
                <div><span className="font-medium">Primary Contact:</span> {getPrimaryContactName(selectedBooking)}</div>
                <div><span className="font-medium">Primary Email:</span> {getPrimaryContactEmail(selectedBooking)}</div>
                <div><span className="font-medium">Primary Phone:</span> {getPrimaryContactPhone(selectedBooking) || "N/A"}</div>
                <div><span className="font-medium">{isKidBooking(selectedBooking) ? "Child Name:" : "Guest Name:"}</span> {selectedBooking.guestName}</div>
                <div><span className="font-medium">Date of Birth:</span> {selectedBooking.guestDateOfBirth || "N/A"}</div>
                <div><span className="font-medium">Class:</span> {selectedBooking.class?.title || "N/A"}</div>
                <div>
                  <span className="font-medium">Class Time:</span>{" "}
                  <span className={isZumFamiliaBooking(selectedBooking)
                    ? "inline-flex items-center px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-semibold"
                    : ""}>
                    {getDisplayScheduleTime(selectedBooking)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Booked On:</span>{" "}
                  <span className="text-gray-900 dark:text-white font-medium">
                    {selectedBooking.bookedAt ? formatDateTime(selectedBooking.bookedAt) : "N/A"}
                  </span>
                </div>
                <div><span className="font-medium">Payment:</span> {selectedBooking.payment ? `${(selectedBooking.payment.amountCents / 100).toFixed(2)} ${selectedBooking.payment.currency}` : "No payment"}</div>
                <div><span className="font-medium">Payment Status:</span> {selectedBooking.payment?.status || "N/A"}</div>
              </div>

              {/* 2nd Guest (Companion) Box */}
              {(() => {
                const bookingP2 = selectedBooking ? getParticipant2(selectedBooking) : null;
                if (bookingP2) {
                  return (
                    <div className="rounded-lg border border-lime-300 dark:border-lime-700 p-3.5 bg-lime-50 dark:bg-lime-950/40 space-y-2">
                      <div className="font-bold text-lime-900 dark:text-lime-300 flex items-center justify-between text-xs uppercase tracking-wide">
                        <span className="flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> 2nd Guest (1-for-1 Companion) Details</span>
                        <span className="rounded bg-lime-200 dark:bg-lime-900/60 text-lime-900 dark:text-lime-200 px-2 py-0.5 text-[10px]">Attached</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="font-medium mb-2 flex items-center gap-2">
                    <span>Waiver / Booking Notes</span>
                    {/PENDING/.test(selectedBooking.cancellationReason) ? (
                      <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Not signed yet
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Signed
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 break-words text-xs">{selectedBooking.cancellationReason}</p>
                  {/PENDING/.test(selectedBooking.cancellationReason) && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Guest agreed to the waiver before paying but hasn&apos;t completed NRIC + signature. Collect this at check-in.
                    </p>
                  )}
                </div>
              )}

              {isZumFamiliaBooking(selectedBooking) && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="font-medium mb-2">ZumFamilia Extras</div>
                  <div><span className="font-medium">Package:</span> {selectedBooking.payment?.metadata?.package_label || selectedBooking.payment?.metadata?.package_option || "N/A"}</div>
                  <div><span className="font-medium">Custom Schedule:</span> {selectedBooking.payment?.metadata?.custom_schedule || "N/A"}</div>
                  <div><span className="font-medium">Notes:</span> {selectedBooking.payment?.metadata?.notes || "N/A"}</div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mt-6">
            <Button
              size="sm"
              className="bg-lime-600 hover:bg-lime-700 text-white flex items-center gap-1.5 border-0 font-medium"
              onClick={() => {
                setDetailsModalOpen(false);
                if (selectedBooking) handleOpenCompanionModal(selectedBooking);
              }}
            >
              <UserPlus className="w-4 h-4" />
              + Add / Edit 2nd Guest
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDetailsModalOpen(false);
                setSelectedBooking(null);
              }}
            >
              Close
            </Button>
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
        className="max-w-[480px] w-full"
      >
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Cancel Booking
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Add a reason for cancelling so you can track follow-up.
          </p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cancellation reason
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Called - not interested, Emailed - no response..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason("");
                setCancelBookingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
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
              className="bg-orange-600 hover:bg-orange-700 text-white border-0"
            >
              Confirm Cancellation
            </Button>
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
        className="max-w-[420px] w-full"
      >
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Delete Booking
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            Are you sure you want to delete the booking for <strong className="text-gray-900 dark:text-white">{deleteBookingName}</strong>? 
            This cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteBookingId(null);
                setDeleteBookingName("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white border-0"
            >
              {deletingId ? "Deleting..." : "Delete Booking"}
            </Button>
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
        className="max-w-[500px] w-full"
      >
        <form onSubmit={handleAddCompanionSubmit} className="p-6">
          <div className="flex items-center gap-2 mb-2 text-lime-700 dark:text-lime-400">
            <UserPlus className="w-5 h-5" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add 2nd Guest (1-for-1 Companion)
            </h4>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={companionForm.guestDateOfBirth}
                  onChange={(e) => setCompanionForm({ ...companionForm, guestDateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <select
                  value={companionForm.gender}
                  onChange={(e) => setCompanionForm({ ...companionForm, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 text-sm"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 text-sm"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                If left blank, a guest placeholder email will be auto-generated.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800 mt-6">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCompanionModalOpen(false);
                setCompanionBooking(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingCompanion}
              className="bg-lime-600 hover:bg-lime-700 text-white border-0 font-medium"
            >
              {submittingCompanion ? "Saving..." : "Add Companion Booking"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
