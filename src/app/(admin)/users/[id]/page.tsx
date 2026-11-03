"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import StudioDate from "@/components/ui/StudioDate";
import { useUser, useInvalidateUser, type UserDetail } from "@/hooks/useUser";
import { RefreshCw, Upload, Trash2, Copy, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { isExpiredBySgtCalendar, sgtDaysUntilExpiry } from "@/lib/reports-utils";
import { InvoicePreviewModal, type PreviewInvoice } from "@/components/invoices/InvoicePreviewModal";

const LOADING_TIMEOUT = 15000; // 15 seconds

function StudioMenu({
  id,
  value,
  onChange,
  placeholder,
  options,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string; hint?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  const place = () => {
    const node = buttonRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const openUp = below < 180 && above > below;
    const maxHeight = Math.max(140, Math.min(280, openUp ? above : below));
    setBox({
      top: openUp ? Math.max(8, rect.top - 8 - maxHeight) : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative mt-1.5">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-neutral-50 px-4 text-left text-sm dark:bg-white/5 ${
          open
            ? "border-neutral-950 dark:border-white"
            : "border-neutral-200 dark:border-white/10"
        }`}
      >
        <span className={`truncate ${selected ? "font-medium text-neutral-950 dark:text-white" : "text-neutral-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[100001] overflow-auto rounded-[22px] border border-neutral-200/80 bg-white p-1.5 shadow-[0_18px_50px_rgba(16,24,40,0.16)] dark:border-white/10 dark:bg-neutral-950"
            style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-neutral-500">Nothing to choose</div>
            ) : (
              options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-2xl px-3 py-2.5 text-left ${
                      active
                        ? "bg-[#E4F56C] text-neutral-950"
                        : "text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    {option.hint ? (
                      <span className={`mt-0.5 text-xs ${active ? "text-neutral-950/70" : "text-neutral-500 dark:text-white/45"}`}>
                        {option.hint}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

interface ClassHistory {
  id: string;
  className: string;
  instructor: string;
  date: string;
  time: string;
  status: "attended" | "no-show" | "cancelled" | "confirmed" | "waitlist";
}

interface TokenTransaction {
  id: string;
  type: "purchase" | "consume" | "hold" | "release" | "adjustment" | "expire";
  amount: number;
  balance: number;
  description: string;
  date: string;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  description: string | null;
  totalCents: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  issuedAt: string | null;
}

interface PaymentMissingInvoice {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  createdAt: string;
}

// Removed placeholder arrays - now using real state

type TabType = "overview" | "classes" | "tokens" | "invoices" | "notes";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { invalidateDetail } = useInvalidateUser();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isAdjustPanelOpen, setIsAdjustPanelOpen] = useState(false);
  const [mode, setMode] = useState<"sell" | "adjust">("sell");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [expiryDays, setExpiryDays] = useState("365"); // Default to 1 year
  const [packages, setPackages] = useState<Array<{ id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }>>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [discount, setDiscount] = useState("");
  const [userPackages, setUserPackages] = useState<Array<{ id: string; packageName: string; tokensRemaining: number; purchasedAt: string; expiresAt: string; status: string }>>([]);
  const [isLoadingUserPackages, setIsLoadingUserPackages] = useState(false);
  const [isExtendPanelOpen, setIsExtendPanelOpen] = useState(false);
  const [extendingPackage, setExtendingPackage] = useState<{ id: string; packageName: string; expiresAt: string } | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [isExtendingExpiry, setIsExtendingExpiry] = useState(false);
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [physicalFormFile, setPhysicalFormFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
  });
  const [classHistory, setClassHistory] = useState<ClassHistory[]>([]);
  const [isLoadingClassHistory, setIsLoadingClassHistory] = useState(false);
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([]);
  const [isLoadingTokenTransactions, setIsLoadingTokenTransactions] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [missingInvoicePayments, setMissingInvoicePayments] = useState<PaymentMissingInvoice[]>([]);
  const [isLoadingMissingInvoices, setIsLoadingMissingInvoices] = useState(false);
  const [generatingPaymentId, setGeneratingPaymentId] = useState<string | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<PreviewInvoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isProcessingTokens, setIsProcessingTokens] = useState(false);
  const [isSendingForm, setIsSendingForm] = useState(false);
  const [isCopyingFormLink, setIsCopyingFormLink] = useState(false);
  const [formLinkCopied, setFormLinkCopied] = useState(false);
  const [registrationFormStatus, setRegistrationFormStatus] = useState<'pending' | 'completed' | 'expired' | null>(null);
  const [showReferralPanel, setShowReferralPanel] = useState(false);
  const [referralDiscountPercent, setReferralDiscountPercent] = useState(8);
  const [latestVoucher, setLatestVoucher] = useState<{ id: string; voucherCode: string; discountPercent: number; createdAt: string; sentAt: string | null; usedAt: string | null } | null>(null);
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(false);
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Fetch user detail with React Query caching
  // cacheBuster already handles cache invalidation, no need to manually clear
  const { data: user, isLoading: loading, error: queryError, refetch } = useUser(userId, forceRefreshKey);

  // Initialize edit form when user data loads
  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        gender: user.gender || "",
        bloodGroup: user.bloodGroup || "",
      });
      setNotes(user.notes || "");
    }
  }, [user]);

  // Fetch class history when classes tab is active
  useEffect(() => {
    if (activeTab !== "classes" || !user?.id) return;

    let cancelled = false;
    setIsLoadingClassHistory(true);

    api.get<{ success: boolean; data: { bookings: unknown[] } }>(`/api/bookings?userId=${user.id}&pageSize=100`)
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          console.error("Failed to fetch class history:", response.error);
          setClassHistory([]);
          return;
        }

        const payload = (response.data as { data?: { bookings?: unknown[] }; bookings?: unknown[] })?.data ?? response.data;
        const bookings = (payload as { bookings?: unknown[] })?.bookings ?? [];

        const history: ClassHistory[] = bookings.map((booking: any) => {
          const cls = booking.class ?? {};
          const scheduledAt = cls.scheduled_at || cls.scheduledAt;
          const durationMinutes = cls.duration_minutes ?? cls.durationMinutes ?? 60;
          const classDate = new Date(scheduledAt);
          const endTime = new Date(classDate.getTime() + durationMinutes * 60000);
          const rawStatus = booking.status as string;

          return {
            id: booking.id,
            className: cls.title || "Class",
            instructor: cls.instructor_name || cls.instructorName || "TBA",
            date: scheduledAt,
            time: `${classDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" })} - ${endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" })}`,
            status:
              rawStatus === "attended" ? "attended"
              : rawStatus === "no-show" || rawStatus === "no_show" ? "no-show"
              : rawStatus === "cancelled" || rawStatus === "cancelled-late" ? "cancelled"
              : rawStatus === "waitlist" ? "waitlist"
              : "confirmed",
          };
        });

        setClassHistory(history);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch class history:", err);
          setClassHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingClassHistory(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  const mapTokenTransactionType = (txType: string): TokenTransaction["type"] => {
    if (txType === "purchase" || txType === "trial-booking-purchase") return "purchase";
    if (txType === "booking-consume" || txType === "attendance-consume" || txType === "no-show-consume" || txType === "late-cancel-consume") return "consume";
    if (txType === "expire") return "expire";
    if (txType === "admin-adjust") return "adjustment";
    if (txType === "booking-release" || txType === "refund") return "release";
    if (txType === "booking-hold") return "hold";
    return "adjustment";
  };

  // Fetch token transactions when tokens tab is active
  useEffect(() => {
    if (activeTab !== "tokens" || !user?.id) return;

    let cancelled = false;
    setIsLoadingTokenTransactions(true);

    api.get<{ success: boolean; data: { transactions: unknown[] } }>(`/api/tokens/transactions?userId=${user.id}&pageSize=100`)
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          console.error("Failed to fetch token transactions:", response.error);
          setTokenTransactions([]);
          return;
        }

        const payload = (response.data as { data?: { transactions?: unknown[] }; transactions?: unknown[] })?.data ?? response.data;
        const rows = (payload as { transactions?: unknown[] })?.transactions ?? [];

        const transactions: TokenTransaction[] = rows.map((tx: any) => {
          const txType = tx.transaction_type || tx.transactionType || tx.type || "";
          return {
            id: tx.id,
            type: mapTokenTransactionType(txType),
            amount: tx.tokens_change ?? tx.tokensChange ?? 0,
            balance: tx.tokens_after ?? tx.tokensAfter ?? 0,
            description: tx.description || "",
            date: tx.created_at || tx.createdAt,
          };
        });

        setTokenTransactions(transactions);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch token transactions:", err);
          setTokenTransactions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTokenTransactions(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  // Fetch invoices when the Invoices tab is opened
  useEffect(() => {
    if (activeTab !== "invoices" || !user?.id) return;

    let cancelled = false;
    setIsLoadingInvoices(true);

    api.get<{ success: boolean; data: { invoices: unknown[] } }>(`/api/users/${user.id}/invoices?pageSize=100`)
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          console.error("Failed to fetch invoices:", response.error);
          setInvoices([]);
          return;
        }

        const payload = (response.data as { data?: { invoices?: unknown[] }; invoices?: unknown[] })?.data ?? response.data;
        const rows = (payload as { invoices?: unknown[] })?.invoices ?? [];

        const rowsMapped: InvoiceRow[] = rows.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          description: inv.description,
          totalCents: inv.totalCents,
          currency: inv.currency,
          status: inv.status,
          pdfUrl: inv.pdfUrl,
          issuedAt: inv.issuedAt || inv.createdAt,
        }));

        setInvoices(rowsMapped);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch invoices:", err);
          setInvoices([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInvoices(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  // Fetch succeeded payments that never got an invoice (backfill candidates)
  useEffect(() => {
    if (activeTab !== "invoices" || !user?.id) return;

    let cancelled = false;
    setIsLoadingMissingInvoices(true);

    api.get<{ data: { payments: PaymentMissingInvoice[] } }>(`/api/users/${user.id}/payments/missing-invoices`)
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          console.error("Failed to fetch payments missing invoices:", response.error);
          setMissingInvoicePayments([]);
          return;
        }
        setMissingInvoicePayments(response.data?.data?.payments || []);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch payments missing invoices:", err);
          setMissingInvoicePayments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMissingInvoices(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  // Fetch latest referral voucher when user loads or referral panel opens
  useEffect(() => {
    if (!user?.id || !showReferralPanel) return;
    api.get<{ success: boolean; data: { id: string; voucherCode: string; discountPercent: number; createdAt: string; sentAt: string | null; usedAt: string | null } | null }>(`/api/users/${user.id}/referral-voucher`)
      .then((response: any) => {
        if (response.error || !response.data?.success) return;
        setLatestVoucher(response.data.data ?? null);
      })
      .catch(() => setLatestVoucher(null));
  }, [user?.id, showReferralPanel]);

  // Fetch user packages
  useEffect(() => {
    if (user?.id) {
      setIsLoadingUserPackages(true);
      api.get<{ success: boolean; data: { packages: Array<{ id: string; package?: { name: string }; tokensRemaining: number; purchasedAt: string; expiresAt: string; status: string }> } }>(`/api/user-packages?userId=${user.id}&pageSize=50`)
        .then((response) => {
          if (response.error) {
            console.error("Failed to fetch user packages:", response.error);
            return;
          }
          if (response.data?.success && response.data.data?.packages) {
            setUserPackages(
              response.data.data.packages.map((pkg) => ({
                id: pkg.id,
                packageName: pkg.package?.name || "Adjustment Package",
                tokensRemaining: pkg.tokensRemaining,
                purchasedAt: pkg.purchasedAt,
                expiresAt: pkg.expiresAt,
                status: pkg.status,
              }))
            );
          }
        })
        .catch((err) => {
          console.error("Failed to fetch user packages:", err);
        })
        .finally(() => {
          setIsLoadingUserPackages(false);
        });
    }
  }, [user?.id, forceRefreshKey]);

  // Loading timeout effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    if (loading) {
      setIsLoadingTakingTooLong(false);
      timeoutId = setTimeout(() => {
        setIsLoadingTakingTooLong(true);
      }, LOADING_TIMEOUT);
    } else {
      setIsLoadingTakingTooLong(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading]);

  // Fetch packages when panel opens
  useEffect(() => {
    if (isAdjustPanelOpen && mode === "sell") {
      setIsLoadingPackages(true);
      api.get<{ success: boolean; data: { packages: Array<{ id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }> } }>("/api/packages?isActive=true&pageSize=100")
        .then((response) => {
          if (response.error) {
            console.error("Failed to fetch packages:", response.error);
            toast.showToast(response.error.message || "Failed to load packages", "error");
            return;
          }
          if (response.data?.success && response.data.data?.packages) {
            setPackages(response.data.data.packages.map((pkg: { id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }) => ({
              id: pkg.id,
              name: pkg.name,
              tokenCount: pkg.tokenCount,
              validityDays: pkg.validityDays,
              priceCents: pkg.priceCents,
              currency: pkg.currency || "SGD",
            })));
          }
        })
        .catch((err) => {
          console.error("Failed to fetch packages:", err);
          toast.showToast("Failed to load packages", "error");
        })
        .finally(() => {
          setIsLoadingPackages(false);
        });
    }
  }, [isAdjustPanelOpen, mode, toast]);

  // Manual refresh function
  const handleRefresh = () => {
    setIsLoadingTakingTooLong(false);
    invalidateDetail(userId);
    refetch();
  };

  // Show loading state
  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {isLoadingTakingTooLong 
              ? "Loading is taking longer than expected..." 
              : "Loading user details..."}
          </p>
          {isLoadingTakingTooLong && (
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show error state - only show if we have an error AND we're not still loading
  if (queryError && !loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
            Failed to load user
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {queryError instanceof Error ? queryError.message : "User not found"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/users")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error if no user data after loading completes
  if (!loading && !user && !queryError) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
            No user data available
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/users")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const getStatusStyle = (status: UserDetail["status"]) => {
    switch (status) {
      case "active":
        return "bg-[#E4F56C] text-neutral-950";
      case "flagged":
        return "bg-neutral-950 text-[#E4F56C]";
      case "inactive":
        return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const getClassStatusStyle = (status: ClassHistory["status"]) => {
    switch (status) {
      case "attended":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "no-show":
        return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      case "cancelled":
        return "bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400";
      case "confirmed":
        return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "waitlist":
        return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const getTransactionTypeStyle = (type: TokenTransaction["type"]) => {
    switch (type) {
      case "purchase":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "consume":
        return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "hold":
        return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      case "release":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400";
      case "adjustment":
        return "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
      case "expire":
        return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const handleSellOrAdjustTokens = async () => {
    if (!user) {
      toast.showToast("User data not available", "error");
      return;
    }

    setIsProcessingTokens(true);

    if (mode === "sell") {
      if (!selectedPackageId) {
        toast.showToast("Please select a package", "error");
        setIsProcessingTokens(false);
        return;
      }
      try {
        const selectedPkg = packages.find((p) => p.id === selectedPackageId);
        const discountPercent = discount ? parseFloat(discount) : 0;
        const originalPrice = selectedPkg ? selectedPkg.priceCents / 100 : 0;
        const discountAmount = (originalPrice * discountPercent) / 100;
        const finalPrice = Math.max(0, originalPrice - discountAmount);
        
        // Build reason with discount info if applicable
        let reasonText = adjustmentReason || "";
        if (discountPercent > 0) {
          const discountInfo = `Discount: ${discountPercent}% ($${discountAmount.toFixed(2)} off) - Original: $${originalPrice.toFixed(2)}, Final: $${finalPrice.toFixed(2)}`;
          reasonText = reasonText ? `${reasonText} | ${discountInfo}` : discountInfo;
        }

        const response = await api.post<{ success: boolean; data: { tokensAdded: number }; error?: { message: string } }>("/api/user-packages", {
          userId: user.id,
          packageId: selectedPackageId,
          paymentId: `admin-sale-${Date.now()}${discountPercent > 0 ? `-discount-${discountPercent}pct` : ""}`,
        });
        if (response.error) {
          throw new Error(response.error.message || "Failed to sell package");
        }
        if (response.data?.success) {
          const discountMsg = discountPercent > 0 ? ` (with ${discountPercent}% discount - $${discountAmount.toFixed(2)} off)` : "";
          toast.showToast(`Package sold successfully! ${response.data.data.tokensAdded} tokens added.${discountMsg}`, "success");
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setSelectedPackageId("");
          setAdjustmentReason("");
          setDiscount("");
          // Refresh user data
          setForceRefreshKey(prev => prev + 1);
          invalidateDetail(user.id);
          queryClient.invalidateQueries({ queryKey: ["user", user.id] });
          router.refresh();
        } else {
          throw new Error("Failed to sell package");
        }
      } catch (error) {
        console.error("Error selling package:", error);
        toast.showToast(error instanceof Error ? error.message : "Failed to sell package", "error");
      } finally {
        setIsProcessingTokens(false);
      }
    } else {
      // Adjust mode
      if (!adjustmentAmount || !adjustmentReason) {
        toast.showToast("Please fill in all fields", "error");
        setIsProcessingTokens(false);
        return;
      }
      try {
        const response = await api.post<{ success: boolean; error?: { message: string } }>("/api/tokens/adjust", {
          userId: user.id,
          tokensChange: parseInt(adjustmentAmount),
          reason: adjustmentReason,
          expiryDays: parseInt(adjustmentAmount) > 0 ? parseInt(expiryDays) : undefined, // Only set expiry for positive adjustments
        });
        if (response.error) {
          throw new Error(response.error.message || "Failed to adjust tokens");
        }
        if (response.data?.success) {
          toast.showToast(`Tokens ${parseInt(adjustmentAmount) >= 0 ? "added" : "removed"} successfully!`, "success");
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setAdjustmentAmount("");
          setAdjustmentReason("");
          setExpiryDays("365"); // Reset to default
          // Refresh user data
          setForceRefreshKey(prev => prev + 1);
          invalidateDetail(user.id);
          queryClient.invalidateQueries({ queryKey: ["user", user.id] });
          router.refresh();
        } else {
          throw new Error("Failed to adjust tokens");
        }
      } catch (error) {
        console.error("Error adjusting tokens:", error);
        toast.showToast(error instanceof Error ? error.message : "Failed to adjust tokens", "error");
      } finally {
        setIsProcessingTokens(false);
      }
    }
  };

  const openExtendExpiryPanel = (pkg: { id: string; packageName: string; expiresAt: string }) => {
    setExtendingPackage(pkg);
    setExtendDays("30");
    setIsExtendPanelOpen(true);
  };

  const handleExtendExpiry = async () => {
    if (!user?.id || !extendingPackage) return;

    const days = parseInt(extendDays);
    if (!days || days <= 0) {
      toast.showToast("Enter a number of days greater than 0", "error");
      return;
    }

    setIsExtendingExpiry(true);
    try {
      const response = await api.post<{ success: boolean; data: { newExpiresAt: string }; error?: { message: string } }>(
        `/api/user-packages/${extendingPackage.id}/extend-expiry`,
        { userId: user.id, days }
      );

      if (response.error) {
        throw new Error(response.error.message || "Failed to extend expiry");
      }
      if (response.data?.success) {
        const newDate = new Date(response.data.data.newExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        toast.showToast(`Expiry extended to ${newDate}`, "success");
        setIsExtendPanelOpen(false);
        setExtendingPackage(null);
        setForceRefreshKey(prev => prev + 1);
        invalidateDetail(user.id);
        queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      } else {
        throw new Error("Failed to extend expiry");
      }
    } catch (error) {
      console.error("Error extending package expiry:", error);
      toast.showToast(error instanceof Error ? error.message : "Failed to extend expiry", "error");
    } finally {
      setIsExtendingExpiry(false);
    }
  };

  const handlePhysicalFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.showToast('Invalid file type. Please upload a PDF, JPEG, PNG, or WebP file.', 'error');
        return;
      }
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.showToast('File size too large. Maximum size is 10MB.', 'error');
        return;
      }
      setPhysicalFormFile(file);
    }
  };

  const handleUploadPhysicalForm = async () => {
    if (!physicalFormFile) {
      toast.showToast('Please select a file to upload', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to upload files');
      }

      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', physicalFormFile);
      formData.append('userId', userId);

      const uploadResponse = await fetch('/api/users/upload-physical-form', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          // Don't set Content-Type, let browser set it with boundary
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message || 'Failed to upload file');
      }

      // Step 2: Update user profile with the physical form URL
      const updateResponse = await fetch(`/api/users/${userId}/physical-form`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          physicalFormUrl: uploadResult.data.url,
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        throw new Error(updateResult.error?.message || 'Failed to update user profile');
      }

      toast.showToast('Physical form uploaded successfully', 'success');
      setIsUploadPanelOpen(false);
      setPhysicalFormFile(null);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process the update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      const refetchResult = await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
      
      // Also trigger Next.js router refresh for server-side updates
      router.refresh();
      
      // If refetch didn't work, try invalidating all user queries
      if (!refetchResult.data) {
        queryClient.invalidateQueries({
          queryKey: ['user'],
        });
        await refetch();
        setForceRefreshKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error uploading physical form:', error);
      toast.showToast(error.message || 'Failed to upload physical form', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhysicalForm = async () => {
    if (!user || !user.physicalFormUrl) {
      return;
    }

    if (!confirm('Are you sure you want to delete this physical form? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to delete files');
      }

      const response = await fetch(`/api/users/${userId}/physical-form`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete physical form');
      }

      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      toast.showToast('Physical form deleted successfully', 'success');
      
      // Wait a moment for the API to process the deletion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      const deleteRefetchResult = await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
      
      // Also trigger Next.js router refresh for server-side updates
      router.refresh();
      
      // If refetch didn't work, try invalidating all user queries
      if (!deleteRefetchResult.data) {
        queryClient.invalidateQueries({
          queryKey: ['user'],
        });
        await refetch();
        setForceRefreshKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error deleting physical form:', error);
      toast.showToast(error.message || 'Failed to delete physical form', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendRegistrationForm = async () => {
    if (!user?.email) {
      toast.showToast('User does not have an email address', 'error');
      return;
    }

    if (!confirm(`Send registration form to ${user.email}?`)) {
      return;
    }

    setIsSendingForm(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to send form');
      }

      const response = await fetch('/api/registration-form/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send registration form');
      }

      toast.showToast('Registration form sent successfully', 'success');
      setRegistrationFormStatus('pending');
      
      // Refresh user data to get form status
      setForceRefreshKey(prev => prev + 1);
      invalidateDetail(userId);
      await refetch();
    } catch (error: any) {
      console.error('Error sending registration form:', error);
      toast.showToast(error.message || 'Failed to send registration form', 'error');
    } finally {
      setIsSendingForm(false);
    }
  };

  // Generates a fresh registration form link and copies it to the clipboard
  // without emailing it, so staff can share it manually (WhatsApp, SMS, in person)
  // when email delivery fails or the customer needs to redo the form.
  // Works regardless of whether a previous form was already signed/completed.
  const handleCopyRegistrationFormLink = async () => {
    if (!user?.id) return;

    setIsCopyingFormLink(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to get form link');
      }

      const response = await fetch('/api/registration-form/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id, skipEmail: true }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate registration form link');
      }

      const formUrl = result.data?.formUrl;
      if (!formUrl) {
        throw new Error('No form link returned');
      }

      try {
        await navigator.clipboard.writeText(formUrl);
        toast.showToast('Form link copied to clipboard', 'success');
        setFormLinkCopied(true);
        setTimeout(() => setFormLinkCopied(false), 2000);
      } catch {
        // Clipboard access can fail (permissions, insecure context); fall back to a visible prompt
        window.prompt('Copy this registration form link:', formUrl);
      }

      // Refresh user data since a new pending form record was created
      setForceRefreshKey(prev => prev + 1);
      invalidateDetail(userId);
      await refetch();
    } catch (error: any) {
      console.error('Error copying registration form link:', error);
      toast.showToast(error.message || 'Failed to get registration form link', 'error');
    } finally {
      setIsCopyingFormLink(false);
    }
  };

  const handleViewInvoice = (inv: InvoiceRow) => {
    setInvoicePreview({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      totalCents: inv.totalCents,
      currency: inv.currency,
      pdfUrl: inv.pdfUrl,
      billToName: user?.name,
      billToEmail: user?.email,
    });
    setInvoicePreviewOpen(true);
  };

  const handleGenerateInvoice = async (payment: PaymentMissingInvoice) => {
    setGeneratingPaymentId(payment.id);
    try {
      type GeneratedInvoice = {
        id: string; invoiceNumber: string; description: string | null;
        amountCents: number; currency: string; pdfUrl: string | null;
        billToName?: string | null; billToEmail?: string | null;
        originalAmountCents?: number | null; discountPercent?: number | null; discountAmountCents?: number | null;
      };
      const response = await api.post<{ data?: GeneratedInvoice; error?: { message: string } }>(
        `/api/payments/${payment.id}/generate-invoice`, {}
      );
      if (response.error || !response.data?.data) {
        toast.showToast(response.error?.message || "Failed to generate invoice", "error");
        return;
      }
      const inv = response.data.data;
      setMissingInvoicePayments((prev) => prev.filter((p) => p.id !== payment.id));
      setInvoices((prev) => [
        {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          description: inv.description,
          totalCents: inv.amountCents,
          currency: inv.currency,
          status: "issued",
          pdfUrl: inv.pdfUrl,
          issuedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setInvoicePreview({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description,
        totalCents: inv.amountCents,
        currency: inv.currency,
        pdfUrl: inv.pdfUrl,
        billToName: inv.billToName ?? user?.name,
        billToEmail: inv.billToEmail ?? user?.email,
        originalAmountCents: inv.originalAmountCents,
        discountPercent: inv.discountPercent,
        discountAmountCents: inv.discountAmountCents,
      });
      setInvoicePreviewOpen(true);
    } catch (error: any) {
      toast.showToast(error.message || "Failed to generate invoice", "error");
    } finally {
      setGeneratingPaymentId(null);
    }
  };

  const handleGenerateVoucher = async () => {
    if (!user?.id) return;
    setIsGeneratingVoucher(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in");
      const response = await fetch(`/api/users/${userId}/referral-voucher/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ discountPercent: referralDiscountPercent }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Failed to generate voucher");
      setLatestVoucher({
        id: result.data.id,
        voucherCode: result.data.voucherCode,
        discountPercent: result.data.discountPercent,
        createdAt: result.data.createdAt,
        sentAt: null,
        usedAt: null,
      });
      toast.showToast(`Voucher ${result.data.voucherCode} created (${result.data.discountPercent}% off)`, "success");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to generate voucher", "error");
    } finally {
      setIsGeneratingVoucher(false);
    }
  };

  const handleSendVoucherEmail = async () => {
    if (!user?.id || !latestVoucher?.id) return;
    setIsSendingVoucher(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in");
      const response = await fetch(`/api/users/${userId}/referral-voucher/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ voucherId: latestVoucher.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Failed to send email");
      setLatestVoucher((v) => (v ? { ...v, sentAt: new Date().toISOString() } : null));
      toast.showToast("Voucher email sent successfully", "success");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to send email", "error");
    } finally {
      setIsSendingVoucher(false);
    }
  };

  const handleDeactivateUser = async () => {
    if (!user) {
      toast.showToast('User data not available', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to deactivate ${user.name}? This will prevent them from booking classes.`)) {
      return;
    }

    setIsDeactivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to deactivate users');
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || result.message || 'Failed to deactivate user');
      }

      toast.showToast('User deactivated successfully', 'success');
      
      // Refresh user data
      invalidateDetail(userId);
      await refetch();
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      toast.showToast(error.message || 'Failed to deactivate user', 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateUser = async () => {
    if (!user) {
      toast.showToast('User data not available', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to reactivate ${user.name}? They will be able to book classes again.`)) {
      return;
    }

    setIsReactivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to reactivate users');
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || result.message || 'Failed to reactivate user');
      }

      toast.showToast('User reactivated successfully', 'success');
      
      // Refresh user data
      invalidateDetail(userId);
      await refetch();
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error reactivating user:', error);
      toast.showToast(error.message || 'Failed to reactivate user', 'error');
    } finally {
      setIsReactivating(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editForm.name || !editForm.email) {
      toast.showToast('Name and email are required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to update user');
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          dateOfBirth: editForm.dateOfBirth || null,
          gender: editForm.gender || null,
          bloodGroup: editForm.bloodGroup || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || result.message || 'Failed to update user');
      }

      toast.showToast('User updated successfully', 'success');
      setIsEditPanelOpen(false);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.showToast(error.message || 'Failed to update user', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.showToast('Please upload a JPEG, PNG, WebP, or GIF image.', 'error');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.showToast('Maximum file size is 5MB.', 'error');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Get session token for upload
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.showToast('Please sign in to upload avatar', 'error');
        return;
      }

      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.showToast(errorData.error?.message || 'Failed to upload avatar', 'error');
        return;
      }

      const data = await response.json();
      if (data.success) {
        toast.showToast('User profile picture has been updated successfully.', 'success');
        // Refresh user data
        setForceRefreshKey(prev => prev + 1);
        invalidateDetail(userId);
        await refetch();
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.showToast('Failed to upload avatar', 'error');
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "classes", label: "Class History" },
    { key: "tokens", label: "Token History" },
    { key: "invoices", label: "Invoices" },
    { key: "notes", label: "Notes" },
  ];

  // Cache-buster so non-technical users always see the latest file without clearing cache
  const physicalFormUrlWithNoCache = user?.physicalFormUrl
    ? `${user.physicalFormUrl}?cb=${Date.now()}`
    : null;

  // Early return if user is not loaded yet
  if (loading || !user) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 text-gray-500 dark:text-gray-400">Loading user details...</div>
          </div>
        </div>
      </div>
    );
  }

  // TypeScript type guard: user is guaranteed to be defined after the check above
  // Use non-null assertion since we've already checked
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const userData = user!;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-5">
            <div className="relative shrink-0">
              {userData.avatarUrl ? (
                <img
                  src={userData.avatarUrl}
                  alt={userData.name}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-950 text-2xl font-semibold text-[#E4F56C]">
                  {getInitials(userData.name)}
                </div>
              )}
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#E4F56C] text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-50"
                title="Upload profile picture"
              >
                {isUploadingAvatar ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-neutral-950 border-t-transparent"></div>
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="min-w-0 pb-1">
              <button
                onClick={() => router.push("/users")}
                className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
              >
                ← Users
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">{userData.name}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                    userData.status
                  )}`}
                >
                  {userData.status.charAt(0).toUpperCase() + userData.status.slice(1)}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-neutral-500 dark:text-white/50">
                {userData.email}
                {userData.phone ? ` · ${userData.phone}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsAdjustPanelOpen(true)}
              className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]"
            >
              Sell Tokens
            </button>
            <button
              onClick={() => setIsEditPanelOpen(true)}
              className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Edit User
            </button>
            {userData.isActive ? (
              <button
                onClick={handleDeactivateUser}
                disabled={isDeactivating}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                {isDeactivating ? "Deactivating..." : "Deactivate User"}
              </button>
            ) : (
              <button
                onClick={handleReactivateUser}
                disabled={isReactivating}
                className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReactivating ? "Reactivating..." : "Reactivate User"}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4 sm:px-6">
          <div className="rounded-[22px] bg-[#E4F56C] p-4 text-neutral-950">
            <p className="text-3xl font-semibold leading-none tracking-tight">{userData.tokenBalance}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/50">Tokens</p>
          </div>
          <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
            <p className="text-3xl font-semibold leading-none tracking-tight">{userData.classesAttended + userData.noShows}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Classes</p>
          </div>
          <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-3xl font-semibold leading-none tracking-tight text-neutral-950 dark:text-white">{userData.classesAttended}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Attended</p>
          </div>
          <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-3xl font-semibold leading-none tracking-tight text-neutral-950 dark:text-white">{userData.noShows}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">No-shows</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-neutral-950 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 md:col-span-2">
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Personal</h3>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Full Name</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{userData.name}</dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Email</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{userData.email}</dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Phone</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{userData.phone || "-"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Date of Birth</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {userData.dateOfBirth 
                        ? new Date(userData.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "-"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Gender</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{userData.gender || "-"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Blood Group</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{userData.bloodGroup || "-"}</dd>
                  </div>
                  <div className="flex flex-col items-start gap-2 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:col-span-2 lg:col-span-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Registration Form</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {/* Digital Form Status & Actions */}
                      {userData.registrationFormSentAt && !userData.registrationFormId && (
                        <span className="inline-flex items-center rounded-full bg-[#E4F56C] px-2.5 py-0.5 text-xs font-semibold text-neutral-950">
                          📤 Sent - Awaiting User
                        </span>
                      )}
                      {userData.registrationFormId && (
                        <a
                          href={`/users/${userData.id}/registration-form`}
                          className="inline-flex items-center rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                          title="View and sign digital registration form"
                        >
                          ✓ View & Sign Digital Form
                        </a>
                      )}
                      
                      {/* Physical Form Actions */}
                      {userData.physicalFormUrl ? (
                        <>
                          <a
                            href={physicalFormUrlWithNoCache || userData.physicalFormUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                          >
                            View Physical Form
                          </a>
                          <button
                            onClick={() => setIsUploadPanelOpen(true)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Replace physical form"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleDeletePhysicalForm}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Delete physical form"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        !userData.registrationFormId && (
                          <button
                            onClick={() => setIsUploadPanelOpen(true)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Upload physical form"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                        )
                      )}
                      
                      {/* Send Digital Form Button */}
                      <button
                        onClick={handleSendRegistrationForm}
                        disabled={isSendingForm || !userData.email}
                        className="rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-50"
                        title={userData.registrationFormSentAt ? "Resend digital registration form" : "Send digital registration form"}
                      >
                        {isSendingForm ? 'Sending...' : (userData.registrationFormSentAt ? 'Resend Form' : 'Send Form')}
                      </button>

                      {/* Copy Form Link Button - always available, even if a form was already signed,
                          so staff can grab a working link when email delivery fails or the form needs redoing */}
                      <button
                        onClick={handleCopyRegistrationFormLink}
                        disabled={isCopyingFormLink || !user?.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white"
                        title="Copy the registration form link to clipboard"
                      >
                        {formLinkCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> {isCopyingFormLink ? 'Getting Link...' : 'Copy Link'}
                          </>
                        )}
                      </button>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Early Bird Status</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.earlyBirdEligible ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-[#E4F56C] px-2.5 py-0.5 text-xs font-semibold text-neutral-950">
                            Eligible
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {user.earlyBirdExpiresAt 
                              ? `(Expires: ${new Date(user.earlyBirdExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` 
                              : '(Valid for 90 days from first class)'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">Not Eligible</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-col items-start gap-2 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:col-span-2 lg:col-span-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Referral Discount</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      <button
                        onClick={() => setShowReferralPanel(true)}
                        className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-[#E4F56C] hover:bg-neutral-800"
                        title="Generate and send referral voucher"
                      >
                        Referral Discount
                      </button>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Address</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.address || "-"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Emergency Contact</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.emergencyContact || "-"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Membership Information */}
              <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 md:col-span-2">
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Membership</h3>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Member Since</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(user.joinedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Last Active</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(user.lastActive).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                          user.status
                        )}`}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Token Balance</dt>
                    <dd className={`text-sm font-bold ${user.tokenBalance === 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {user.tokenBalance} tokens
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Attendance Rate</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.classesAttended + user.noShows > 0
                        ? Math.round((user.classesAttended / (user.classesAttended + user.noShows)) * 100)
                        : 0}%
                    </dd>
                  </div>
                </dl>
              </div>

              {/* User Packages */}
              <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 md:col-span-2">
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Token packages</h3>
                {isLoadingUserPackages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading packages...</span>
                  </div>
                ) : userPackages.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No packages</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Package
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Purchased
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Tokens Remaining
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Expiry Date
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Status
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {userPackages.map((pkg) => {
                          const dateOpts: Intl.DateTimeFormatOptions = {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "Asia/Singapore",
                          };
                          const isExpired = pkg.status === "expired" || isExpiredBySgtCalendar(pkg.expiresAt);
                          const daysLeft = sgtDaysUntilExpiry(pkg.expiresAt);
                          const isExpiringSoon = !isExpired && daysLeft >= 0 && daysLeft <= 7;
                          const displayStatus = isExpired
                            ? pkg.status === "expired"
                              ? "Expired"
                              : "Expired (pending cleanup)"
                            : pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1);
                          return (
                            <tr key={pkg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {pkg.packageName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                {new Date(pkg.purchasedAt).toLocaleDateString("en-US", dateOpts)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {pkg.tokensRemaining}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={isExpired ? "text-red-600 dark:text-red-400" : isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}>
                                  {new Date(pkg.expiresAt).toLocaleDateString("en-US", dateOpts)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isExpired
                                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                      : pkg.status === "active"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : "bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400"
                                  }`}
                                >
                                  {displayStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {pkg.status !== "cancelled" && (
                                  <button
                                    onClick={() => openExtendExpiryPanel(pkg)}
                                    className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                                  >
                                    Extend
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="rounded-full bg-neutral-950 px-4 py-2 text-center text-sm text-white/70 md:col-span-2">
                <span className="font-semibold text-[#E4F56C]">{user.classesAttended}</span> attended
                <span className="mx-2 text-white/30">·</span>
                {user.classesAttended + user.noShows} classes
                <span className="mx-2 text-white/30">·</span>
                {user.noShows} no-shows
                <span className="mx-2 text-white/30">·</span>
                <span className="font-semibold text-white">{user.tokenBalance}</span> tokens
              </p>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="overflow-x-auto rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Class
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Instructor
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date & Time
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {classHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No class history available yet.
                    </td>
                  </tr>
                ) : (
                  classHistory.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">{cls.className}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {cls.instructor}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(cls.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{cls.time}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getClassStatusStyle(
                            cls.status
                          )}`}
                        >
                          {cls.status.charAt(0).toUpperCase() + cls.status.slice(1).replace("-", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === "tokens" && (
          <div className="overflow-x-auto rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Description
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {isLoadingTokenTransactions ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"></div>
                        <span className="ml-2">Loading token transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : tokenTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No token transactions yet.
                    </td>
                  </tr>
                ) : (
                  tokenTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTransactionTypeStyle(
                          tx.type
                        )}`}
                      >
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {tx.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <span className={`font-semibold ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                      {tx.balance}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <>
            {!isLoadingMissingInvoices && missingInvoicePayments.length > 0 && (
              <div className="border-b border-gray-200 bg-amber-50 px-6 py-4 dark:border-gray-800 dark:bg-amber-500/10">
                <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-400">
                  {missingInvoicePayments.length === 1
                    ? "1 successful payment has no invoice yet."
                    : `${missingInvoicePayments.length} successful payments have no invoice yet.`}
                  {" "}These were paid before invoicing existed — generate one to review and send.
                </p>
                <div className="space-y-2">
                  {missingInvoicePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-2.5 dark:border-amber-500/20 dark:bg-gray-900"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{payment.description}</span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                          {payment.currency} {(payment.amountCents / 100).toFixed(2)} ·{" "}
                          {new Date(payment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleGenerateInvoice(payment)}
                        disabled={generatingPaymentId === payment.id}
                        className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
                      >
                        {generatingPaymentId === payment.id ? "Generating..." : "Generate Invoice"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Invoice #
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Description
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {isLoadingInvoices ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"></div>
                        <span className="ml-2">Loading invoices...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No invoices yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {inv.issuedAt
                          ? new Date(inv.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {inv.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                        {inv.currency} {(inv.totalCents / 100).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {inv.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {inv.pdfUrl && (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                            >
                              Download
                            </a>
                          )}
                          <button
                            onClick={() => handleViewInvoice(inv)}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Admin Notes</h3>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  {notes ? "Edit Note" : "Add Note"}
                </button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    rows={8}
                    className="mt-1.5 w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    placeholder="Enter admin notes for this user..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setIsSavingNotes(true);
                      try {
                        const response = await api.put(`/api/users/${user.id}`, {
                          preferences: {
                            ...((user as any).preferences || {}),
                            notes: notes,
                          },
                        });
                        if (response.error) {
                          throw new Error(response.error.message || "Failed to save notes");
                        }
                        toast.showToast("Notes saved successfully", "success");
                        setIsEditingNotes(false);
                        setForceRefreshKey(prev => prev + 1);
                        invalidateDetail(user.id);
                        await refetch();
                      } catch (error) {
                        console.error("Error saving notes:", error);
                        toast.showToast(error instanceof Error ? error.message : "Failed to save notes", "error");
                      } finally {
                        setIsSavingNotes(false);
                      }
                    }}
                    disabled={isSavingNotes}
                    className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingNotes ? "Saving..." : "Save Notes"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setNotes(user.notes || "");
                    }}
                    disabled={isSavingNotes}
                    className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : notes ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{notes}</p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet for this user.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Physical Form Upload Panel */}
      <SlidePanel
        isOpen={isUploadPanelOpen}
        onClose={() => {
          setIsUploadPanelOpen(false);
          setPhysicalFormFile(null);
        }}
        title="Upload Physical Form"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {getInitials(user.name)}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{user.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{user.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="physicalFormFile">Select File</Label>
            <input
              id="physicalFormFile"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handlePhysicalFormFileChange}
              className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-950 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#E4F56C] focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
            </p>
            {physicalFormFile && (
              <div className="mt-2 rounded-[22px] border border-neutral-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white truncate">
                      {physicalFormFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(physicalFormFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {userData.physicalFormUrl && (
            <div className="rounded-[22px] bg-[#E4F56C]/40 p-4 text-neutral-950">
              <p className="text-sm text-neutral-950">
                <strong>Note:</strong> Uploading a new file will replace the existing physical form.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsUploadPanelOpen(false);
                setPhysicalFormFile(null);
              }}
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadPhysicalForm}
              disabled={!physicalFormFile || isUploading}
              className="flex-1 rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? 'Uploading...' : 'Upload Form'}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Referral Discount Panel */}
      <SlidePanel
        isOpen={showReferralPanel}
        onClose={() => setShowReferralPanel(false)}
        title="Referral Discount"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {getInitials(user?.name ?? "")}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{user?.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{user?.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="referralDiscountPercent">Discount percentage</Label>
            <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
              id="referralDiscountPercent"
              type="number"
              min="1"
              max="100"
              value={referralDiscountPercent}
              onChange={(e) => setReferralDiscountPercent(Number(e.target.value) || 8)}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Default 8%. User will receive this discount on their next token package purchase.
            </p>
          </div>

          {!latestVoucher ? (
            <button
              onClick={handleGenerateVoucher}
              disabled={isGeneratingVoucher}
              className="w-full rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGeneratingVoucher ? "Generating..." : "Generate"}
            </button>
          ) : (
            <>
              <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Voucher code</p>
                <p className="mt-1 font-mono text-lg font-semibold text-[#E4F56C]">{latestVoucher.voucherCode}</p>
                <p className="mt-1 text-sm text-white/70">{latestVoucher.discountPercent}% off next package</p>
                {latestVoucher.sentAt && (
                  <p className="mt-2 text-xs text-[#E4F56C]">Email sent</p>
                )}
                {latestVoucher.usedAt && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Already used</p>
                )}
              </div>
              {!latestVoucher.sentAt && !latestVoucher.usedAt && (
                <button
                  onClick={handleSendVoucherEmail}
                  disabled={isSendingVoucher || !user?.email}
                  className="w-full rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSendingVoucher ? "Sending..." : "Send"}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateVoucher}
                  disabled={isGeneratingVoucher}
                  className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white disabled:opacity-50"
                >
                  {isGeneratingVoucher ? "Generating..." : "Generate another"}
                </button>
              </div>
            </>
          )}

          <div className="flex pt-2">
            <button
              onClick={() => setShowReferralPanel(false)}
              className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Edit User Panel */}
      <SlidePanel
        isOpen={isEditPanelOpen}
        onClose={() => {
          setIsEditPanelOpen(false);
          // Reset form to current user data
          if (user) {
            setEditForm({
              name: user.name || "",
              email: user.email || "",
              phone: user.phone || "",
              dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
              gender: user.gender || "",
              bloodGroup: user.bloodGroup || "",
            });
          }
        }}
        title="Edit User"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {getInitials(user.name)}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{user.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{user.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="editName">
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
              id="editName"
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editEmail">
              Email Address <span className="text-error-500">*</span>
            </Label>
            <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
              id="editEmail"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editPhone">Phone Number</Label>
            <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
              id="editPhone"
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editDateOfBirth">Date of Birth</Label>
            <StudioDate
              id="editDateOfBirth"
              block
              clearable
              ariaLabel="Date of birth"
              placeholder="Date of birth"
              value={editForm.dateOfBirth}
              onChange={(value) => setEditForm({ ...editForm, dateOfBirth: value })}
            />
          </div>

          <div>
            <Label htmlFor="editGender">Gender</Label>
            <StudioMenu
              id="editGender"
              value={editForm.gender}
              onChange={(gender) => setEditForm({ ...editForm, gender })}
              placeholder="Select gender"
              options={[
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Not sure", label: "Not sure" },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="editBloodGroup">Blood Group</Label>
            <StudioMenu
              id="editBloodGroup"
              value={editForm.bloodGroup}
              onChange={(bloodGroup) => setEditForm({ ...editForm, bloodGroup })}
              placeholder="Select blood group"
              options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => ({
                value: group,
                label: group,
              }))}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditPanelOpen(false);
                if (user) {
                  setEditForm({
                    name: user.name || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
                    gender: user.gender || "",
                    bloodGroup: user.bloodGroup || "",
                  });
                }
              }}
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateUser}
              disabled={!editForm.name || !editForm.email || isUpdating}
              className="flex-1 rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Token Sell/Adjust Panel */}
      <SlidePanel
        isOpen={isAdjustPanelOpen}
        onClose={() => {
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setSelectedPackageId("");
          setAdjustmentAmount("");
          setAdjustmentReason("");
          setDiscount("");
        }}
        title="Sell Tokens"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {getInitials(user.name)}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{user.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{user.email}</div>
            </div>
          </div>

          <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Current Balance</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {user.tokenBalance} <span className="text-lg font-normal text-[#E4F56C]">tokens</span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div>
            <Label>Mode</Label>
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => {
                  setMode("sell");
                  setSelectedPackageId("");
                  setAdjustmentAmount("");
                  setExpiryDays("365");
                }}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mode === "sell"
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                Sell Package
              </button>
              <button
                onClick={() => {
                  setMode("adjust");
                  setSelectedPackageId("");
                }}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mode === "adjust"
                    ? "bg-[#E4F56C] text-neutral-950"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                Adjust Tokens
              </button>
            </div>
          </div>

          {mode === "sell" ? (
            <>
              <div>
                <Label htmlFor="package">Select Package</Label>
                {isLoadingPackages ? (
                  <div className="mt-1.5 flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 dark:border-white/10 dark:bg-white/5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-neutral-500 dark:text-white/50">Loading packages...</span>
                  </div>
                ) : (
                  <StudioMenu
                    id="package"
                    value={selectedPackageId}
                    onChange={setSelectedPackageId}
                    placeholder="Select a package..."
                    options={packages.map((pkg) => ({
                      value: pkg.id,
                      label: pkg.name,
                      hint: `${pkg.tokenCount} tokens · ${pkg.validityDays} days · $${(pkg.priceCents / 100).toFixed(2)} ${pkg.currency}`,
                    }))}
                  />
                )}
              </div>

              {selectedPackageId && (
                <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-sm text-neutral-500 dark:text-white/50">Package Details</div>
                  {(() => {
                    const selectedPkg = packages.find((p) => p.id === selectedPackageId);
                    if (!selectedPkg) return null;
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + selectedPkg.validityDays);
                    return (
                      <>
                        <div className="mt-2 space-y-1">
                          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                            Tokens: <span className="text-neutral-950">{selectedPkg.tokenCount}</span>
                          </div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                            Expiry Date: <span className="text-neutral-950">{expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="text-sm text-neutral-500 dark:text-white/50">
                            Valid for {selectedPkg.validityDays} days
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-neutral-500 dark:text-white/50">New Balance Preview</div>
                        <div className="mt-1 text-2xl font-bold text-neutral-950 dark:text-white">
                          {user.tokenBalance + selectedPkg.tokenCount}{" "}
                          <span className="text-base font-normal text-neutral-500">tokens</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div>
                <Label htmlFor="discount">Discount Percentage (%)</Label>
                <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
                  id="discount"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                      setDiscount(value);
                    }
                  }}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Enter discount percentage (e.g., 10 for 10% off, 25 for 25% off)
                </p>
              </div>

              {selectedPackageId && discount && (() => {
                const selectedPkg = packages.find((p) => p.id === selectedPackageId);
                if (!selectedPkg) return null;
                const originalPrice = selectedPkg.priceCents / 100;
                const discountPercent = parseFloat(discount) || 0;
                const discountAmount = (originalPrice * discountPercent) / 100;
                const finalPrice = Math.max(0, originalPrice - discountAmount);
                return (
                  <div className="rounded-[22px] bg-[#E4F56C] p-4 text-neutral-950">
                    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-950">Price Summary</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Original Price:</span>
                        <span className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">${originalPrice.toFixed(2)} {selectedPkg.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Discount ({discountPercent}%):</span>
                        <span className="font-medium text-red-600 dark:text-red-400">-${discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="font-semibold text-gray-900 dark:text-white">Final Price:</span>
                        <span className="text-lg font-semibold text-neutral-950">${finalPrice.toFixed(2)} {selectedPkg.currency}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <Label htmlFor="reason-sell">Reason (Optional)</Label>
                <textarea
                  id="reason-sell"
                  rows={2}
                  className="mt-1.5 w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Enter reason for this sale (optional)..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="amount">Adjustment Amount</Label>
                <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
                  id="amount"
                  type="number"
                  placeholder="e.g., 5 or -2"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Use positive numbers to add tokens, negative to remove.
                </p>
              </div>

              {parseInt(adjustmentAmount) > 0 && (
                <div>
                  <Label htmlFor="expiryDays">Expiry Duration (Days)</Label>
                  <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
                    id="expiryDays"
                    type="number"
                    min="1"
                    placeholder="365"
                    value={expiryDays}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || (!isNaN(parseInt(value)) && parseInt(value) > 0)) {
                        setExpiryDays(value);
                      }
                    }}
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Number of days until these tokens expire. Default is 365 days (1 year).
                  </p>
                  {expiryDays && !isNaN(parseInt(expiryDays)) && parseInt(expiryDays) > 0 && (
                    <div className="mt-2 rounded-[22px] border border-neutral-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Expiry Date Preview</div>
                      <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                        {new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="reason">Reason for Adjustment</Label>
                <textarea
                  id="reason"
                  rows={3}
                  className="w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Enter reason for this adjustment..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                />
              </div>

              {adjustmentAmount && (
                <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-sm text-neutral-500 dark:text-white/50">New Balance Preview</div>
                  <div className="mt-1 text-2xl font-bold text-neutral-950 dark:text-white">
                    {user.tokenBalance + parseInt(adjustmentAmount || "0")}{" "}
                    <span className="text-base font-normal text-neutral-500">tokens</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsAdjustPanelOpen(false);
                setMode("sell");
                setSelectedPackageId("");
                setAdjustmentAmount("");
                setAdjustmentReason("");
                setExpiryDays("365");
              }}
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSellOrAdjustTokens}
              disabled={
                isProcessingTokens ||
                (mode === "sell"
                  ? !selectedPackageId
                  : !adjustmentAmount || !adjustmentReason)
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessingTokens && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              )}
              {isProcessingTokens
                ? "Processing..."
                : mode === "sell"
                ? "Sell Package"
                : "Apply Adjustment"}
            </button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel
        isOpen={isExtendPanelOpen}
        onClose={() => {
          setIsExtendPanelOpen(false);
          setExtendingPackage(null);
          setExtendDays("30");
        }}
        title="Extend Token Expiry"
      >
        {extendingPackage && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                {getInitials(user.name)}
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{user.name}</div>
                <div className="text-sm text-neutral-500 dark:text-white/50">{extendingPackage.packageName}</div>
              </div>
            </div>

            <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Current Expiry Date</div>
              <div className="mt-2 text-xl font-semibold text-white">
                {new Date(extendingPackage.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>

            <div>
              <Label htmlFor="extendDays">Extend By (Days)</Label>
              <Input
              className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
                id="extendDays"
                type="number"
                min="1"
                placeholder="30"
                value={extendDays}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || (!isNaN(parseInt(value)) && parseInt(value) > 0)) {
                    setExtendDays(value);
                  }
                }}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Number of extra days to give this package. If it's already expired, the new expiry is counted from today.
              </p>
            </div>

            {extendDays && !isNaN(parseInt(extendDays)) && parseInt(extendDays) > 0 && (
              <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm text-neutral-500 dark:text-white/50">New Expiry Date Preview</div>
                <div className="mt-1 text-2xl font-bold text-neutral-950">
                  {(() => {
                    const base = Math.max(Date.now(), new Date(extendingPackage.expiresAt).getTime());
                    const newDate = new Date(base);
                    newDate.setDate(newDate.getDate() + parseInt(extendDays));
                    return newDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                  })()}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setIsExtendPanelOpen(false);
                  setExtendingPackage(null);
                  setExtendDays("30");
                }}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendExpiry}
                disabled={isExtendingExpiry || !extendDays || parseInt(extendDays) <= 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExtendingExpiry && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                )}
                {isExtendingExpiry ? "Extending..." : "Extend Expiry"}
              </button>
            </div>
          </div>
        )}
      </SlidePanel>

      <InvoicePreviewModal
        isOpen={invoicePreviewOpen}
        onClose={() => setInvoicePreviewOpen(false)}
        invoice={invoicePreview}
      />
    </div>
  );
}