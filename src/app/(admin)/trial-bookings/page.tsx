"use client";

import { useState, useEffect, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import DateRangePicker from "@/components/common/DateRangePicker";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { RefreshCw, Mail, Phone, Calendar, DollarSign, User, Search, Filter, Trash2, CheckCircle, XCircle, MoreVertical } from "lucide-react";
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
    } catch (error: any) {
      console.error("Error fetching trial bookings:", error);
      showToast(error.message || "Failed to fetch trial bookings", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles] || styles.confirmed
        }`}
      >
        {status === "draft" ? "⚠️ Draft (Incomplete)" : status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
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
            Trial Bookings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View and manage guest trial class bookings
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
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        {(dateFrom || dateTo) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Showing bookings for the selected date range (by booked date).</p>
        )}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft (Incomplete)</option>
              <option value="confirmed">Confirmed</option>
              <option value="attended">Attended</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No Show</option>
            </select>
          </div>

          {/* Age Group Filter */}
          <div className="sm:w-40">
            <select
              value={ageGroupFilter}
              onChange={(e) => {
                setAgeGroupFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Ages</option>
              <option value="kid">Kids Only</option>
              <option value="adult">Adults Only</option>
            </select>
          </div>

          {/* Date range filter (by booked date) */}
          <div className="sm:min-w-[220px]">
            <DateRangePicker
              value={{ from: dateFrom, to: dateTo }}
              onChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                setCurrentPage(1);
              }}
              placeholder="Date range (booked)"
              presets={["today", "week", "month", "clear"]}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Bookings</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{total}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-200 dark:border-yellow-800 p-4">
          <div className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">Draft (Leads)</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {useMemo(() => {
              if (statusFilter === "draft") return total;
              return Array.isArray(bookings) ? bookings.filter((b) => b.status === "draft").length : 0;
            }, [bookings, statusFilter, total])}
          </div>
          <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">Needs follow-up</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Confirmed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {useMemo(() => {
              if (statusFilter === "confirmed") return total;
              return Array.isArray(bookings) ? bookings.filter((b) => b.status === "confirmed").length : 0;
            }, [bookings, statusFilter, total])}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Attended</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {useMemo(() => {
              if (statusFilter === "attended") return total;
              return Array.isArray(bookings) ? bookings.filter((b) => b.status === "attended").length : 0;
            }, [bookings, statusFilter, total])}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading trial bookings...</p>
          </div>
        ) : !Array.isArray(bookings) || bookings.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No trial bookings found</p>
            {searchQuery && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Booked At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {bookings
                    .filter((booking) => {
                      if (ageGroupFilter === "all") return true;
                      const isKid = isKidBooking(booking);
                      return ageGroupFilter === "kid" ? isKid : !isKid;
                    })
                    .map((booking) => {
                    const isDraft = booking.status === "draft";
                    const isKid = isKidBooking(booking);
                    return (
                    <tr 
                      key={booking.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        isDraft ? "bg-yellow-50/50 dark:bg-yellow-900/10 border-l-4 border-yellow-400" : ""
                      } ${
                        isKid ? "bg-purple-50/30 dark:bg-purple-900/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {booking.guestName}
                            </div>
                            {isKidBooking(booking) && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-300 dark:border-purple-700">
                                Kid
                              </span>
                            )}
                            {!isKidBooking(booking) && booking.guestDateOfBirth && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300 dark:border-blue-700">
                                Adult
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {booking.guestEmail}
                          </div>
                          {booking.guestPhone && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              {booking.guestPhone}
                            </div>
                          )}
                          {booking.guestDateOfBirth && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              Age: {calculateAge(booking.guestDateOfBirth)} years
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {booking.class ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {booking.class.title}
                            </div>
                            {booking.class.instructorName && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {booking.class.instructorName}
                              </div>
                            )}
                            {booking.class.location && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {booking.class.location}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Class not found</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.class ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDateTime(booking.class.scheduledAt)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.payment ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {(booking.payment.amountCents / 100).toFixed(2)} {booking.payment.currency}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {booking.payment.status}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No payment</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(booking.bookedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {/* Contact Actions */}
                          {isDraft && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <a
                                href={`mailto:${booking.guestEmail}?subject=Complete Your Trial Class Booking&body=Hi ${booking.guestName},%0D%0A%0D%0AWe noticed you started booking a trial class but didn't complete the payment. We'd love to help you finish your booking!%0D%0A%0D%0APlease reply to this email or call us to complete your booking.%0D%0A%0D%0AThank you!`}
                                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1"
                                title="Send Email"
                              >
                                <Mail className="w-3 h-3" />
                                Email
                              </a>
                              {booking.guestPhone && (
                                <a
                                  href={`tel:${booking.guestPhone}`}
                                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                                  title="Call"
                                >
                                  <Phone className="w-3 h-3" />
                                  Call
                                </a>
                              )}
                            </div>
                          )}

                          {/* Status Update Actions */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {isDraft && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(booking.id, "confirmed")}
                                  disabled={updatingStatus === booking.id}
                                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Mark as Confirmed"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => {
                                    setCancelBookingId(booking.id);
                                    setCancelReason("");
                                    setCancelModalOpen(true);
                                  }}
                                  disabled={updatingStatus === booking.id}
                                  className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Mark as Cancelled/Followed Up"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(booking.id, booking.guestName)}
                                  disabled={deletingId === booking.id}
                                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Delete Draft"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </>
                            )}
                            {booking.status === "confirmed" && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(booking.id, "attended")}
                                  disabled={updatingStatus === booking.id}
                                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Mark as Attended"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Attended
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(booking.id, "no-show")}
                                  disabled={updatingStatus === booking.id}
                                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Mark as No Show"
                                >
                                  <XCircle className="w-3 h-3" />
                                  No Show
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(booking.id, booking.guestName)}
                                  disabled={deletingId === booking.id}
                                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Delete Booking"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </>
                            )}
                            {(booking.status === "cancelled" || booking.status === "cancelled-late") && (
                              <button
                                onClick={() => handleDeleteClick(booking.id, booking.guestName)}
                                disabled={deletingId === booking.id}
                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                title="Delete Booking"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} bookings
                    {ageGroupFilter !== "all" && (
                      <span className="ml-2 text-xs">
                        ({bookings.filter((b) => {
                          const isKid = isKidBooking(b);
                          return ageGroupFilter === "kid" ? isKid : !isKid;
                        }).length} {ageGroupFilter === "kid" ? "kids" : "adults"} on this page)
                      </span>
                    )}
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
  );
}
