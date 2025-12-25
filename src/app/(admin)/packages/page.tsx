"use client";

import { useState, useMemo, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { 
  usePackages, 
  useCreatePackage, 
  useUpdatePackage, 
  useTogglePackageStatus,
  PackageWithStats 
} from "@/hooks/usePackages";

// Color mapping for packages
const packageColors = ["blue", "emerald", "amber", "purple", "pink", "brand"] as const;

export default function PackagesPage() {
  const [showPanel, setShowPanel] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tokens: "",
    price: "",
    validityDays: "",
    packageType: "adult" as "adult" | "kid" | "all",
    ageRequirement: "all" as "all" | "5-12" | "13+",
    isFeatured: false,
  });
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // API Hooks
  const { data: packagesData, isLoading, error, refetch } = usePackages();
  const createPackageMutation = useCreatePackage();
  const updatePackageMutation = useUpdatePackage();
  const toggleStatusMutation = useTogglePackageStatus();

  // Get packages from API response
  const packages = packagesData?.packages || [];

  // Stats
  const stats = useMemo(() => {
    const activePackages = packages.filter((p) => p.isActive).length;
    const totalSales = packages.reduce((sum, pkg) => sum + (pkg.salesCount || 0), 0);
    const totalRevenue = packages.reduce((sum, pkg) => sum + (pkg.revenue || 0), 0);
    const avgTokenPrice = packages.length > 0 
      ? packages.reduce((sum, pkg) => sum + ((pkg.priceCents / 100) / pkg.tokenCount), 0) / packages.length 
      : 0;
    return { activePackages, totalSales, totalRevenue, avgTokenPrice };
  }, [packages]);

  const openNewPackagePanel = () => {
    setEditingPackage(null);
    setFormData({ name: "", description: "", tokens: "", price: "", validityDays: "", packageType: "adult", ageRequirement: "all", isFeatured: false });
    setShowPanel(true);
  };

  const openEditPanel = (pkg: PackageWithStats) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      tokens: pkg.tokenCount.toString(),
      price: (pkg.priceCents / 100).toString(),
      validityDays: pkg.validityDays.toString(),
      packageType: (pkg.packageType as "adult" | "kid" | "all") || "adult",
      ageRequirement: (pkg.ageRequirement as "all" | "5-12" | "13+") || "all",
      isFeatured: false, // Note: isFeatured is not in the schema, keeping for UI
    });
    setShowPanel(true);
  };

  const handleSave = async () => {
    try {
      const packageData = {
        name: formData.name,
        description: formData.description || undefined,
        tokenCount: parseInt(formData.tokens),
        priceCents: Math.round(parseFloat(formData.price) * 100),
        validityDays: parseInt(formData.validityDays),
        packageType: formData.packageType,
        ageRequirement: formData.packageType === "kid" ? formData.ageRequirement : "all",
        currency: "SGD",
      };

      if (editingPackage) {
        await updatePackageMutation.mutateAsync({
          id: editingPackage.id,
          data: packageData,
        });
      } else {
        await createPackageMutation.mutateAsync(packageData);
      }
      
      setShowPanel(false);
      refetch();
    } catch (err) {
      console.error('Error saving package:', err);
    }
  };

  const togglePackageStatus = async (pkgId: string, currentStatus: boolean) => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: pkgId,
        isActive: !currentStatus,
      });
      refetch();
    } catch (err) {
      console.error('Error toggling package status:', err);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showPanel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showPanel]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPanel) {
        setShowPanel(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showPanel]);

  // Helper to get a consistent color for a package based on index
  const getPackageColor = (index: number): string => {
    return packageColors[index % packageColors.length];
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    if (!isActive) return "from-gray-400 to-gray-500";
    switch (color) {
      case "blue": return "from-blue-500 to-blue-600";
      case "emerald": return "from-emerald-500 to-emerald-600";
      case "amber": return "from-amber-500 to-amber-600";
      case "purple": return "from-purple-500 to-purple-600";
      case "pink": return "from-pink-500 to-pink-600";
      case "brand": return "from-brand-500 to-brand-600";
      default: return "from-gray-500 to-gray-600";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading packages...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Error loading packages</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Token Packages" />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-600 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Packages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your token packages and pricing</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Table
            </button>
          </div>

          <button
            onClick={openNewPackagePanel}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Package
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/20">
              <svg className="h-6 w-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Packages</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{packages.length}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.activePackages}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Sales</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalSales.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">${stats.totalRevenue.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {packages.length === 0 && (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No packages yet</h3>
          <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Create your first token package to start selling to customers.
          </p>
          <button
            onClick={openNewPackagePanel}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Package
          </button>
        </div>
      )}

      {/* Package Cards View */}
      {viewMode === "cards" && packages.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, index) => {
            const color = getPackageColor(index);
            const price = pkg.priceCents / 100;
            return (
            <div
              key={pkg.id}
              className={`group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-lg dark:bg-gray-900 dark:ring-gray-800 ${
                !pkg.isActive ? "opacity-60" : ""
              }`}
            >
              {/* Header with gradient */}
              <div className={`bg-linear-to-br ${getColorClasses(color, pkg.isActive)} p-6 text-white`}>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold">{pkg.name}</h3>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full uppercase">
                      {pkg.packageType === 'kid' ? 'Kids' : pkg.packageType === 'all' ? 'All' : 'Adults'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/80">{pkg.description}</p>
                  {pkg.packageType === 'kid' && pkg.ageRequirement && (
                    <p className="mt-2 text-xs text-white/70 italic">{pkg.ageRequirement}</p>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${price.toFixed(2)}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Token Info */}
                <div className="mb-6 flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{pkg.tokenCount}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Tokens</div>
                  </div>
                  <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">${(price / pkg.tokenCount).toFixed(2)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Per Token</div>
                  </div>
                  <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{pkg.validityDays}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Days</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Sales</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{pkg.salesCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Revenue</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">${(pkg.revenue || 0).toLocaleString()}</div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    pkg.isActive
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                      : "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20"
                  }`}>
                    {pkg.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditPanel(pkg)}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => togglePackageStatus(pkg.id, pkg.isActive)}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${
                      pkg.isActive
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        : "bg-emerald-500 text-white hover:bg-emerald-600"
                    }`}
                  >
                    {pkg.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && packages.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Package
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Tokens
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Price
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Per Token
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Validity
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Sales
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Revenue
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
                {packages.map((pkg, index) => {
                  const color = getPackageColor(index);
                  const price = pkg.priceCents / 100;
                  return (
                  <tr
                    key={pkg.id}
                    className={`group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!pkg.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${getColorClasses(color, pkg.isActive)} text-white`}>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{pkg.name}</span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{pkg.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{pkg.tokenCount}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-white">${price.toFixed(2)}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-gray-500 dark:text-gray-400">${(price / pkg.tokenCount).toFixed(2)}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-gray-900 dark:text-white">{pkg.validityDays} days</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-white">{pkg.salesCount || 0}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">${(pkg.revenue || 0).toLocaleString()}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        pkg.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                          : "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20"
                      }`}>
                        {pkg.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditPanel(pkg)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => togglePackageStatus(pkg.id, pkg.isActive)}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                            pkg.isActive
                              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                              : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                          }`}
                        >
                          {pkg.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Panel - Modal Overlay */}
      {showPanel && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => setShowPanel(false)}
          />
          
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl dark:bg-gray-900 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingPackage ? "Edit Package" : "New Package"}
                </h2>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Starter Pack"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Great for beginners"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Tokens *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.tokens}
                      onChange={(e) => setFormData({ ...formData, tokens: e.target.value })}
                      placeholder="10"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Price ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="80.00"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.validityDays}
                    onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                    placeholder="60"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Package Type *
                  </label>
                  <select
                    value={formData.packageType}
                    onChange={(e) => setFormData({ ...formData, packageType: e.target.value as "adult" | "kid" | "all" })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="adult">Adult</option>
                    <option value="kid">Kid</option>
                    <option value="all">All (Adult & Kid)</option>
                  </select>
                </div>

                {formData.packageType === "kid" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Age Requirement *
                    </label>
                    <select
                      value={formData.ageRequirement}
                      onChange={(e) => setFormData({ ...formData, ageRequirement: e.target.value as "all" | "5-12" | "13+" })}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="all">All Ages</option>
                      <option value="5-12">5-12 Years Old</option>
                      <option value="13+">13+ Years Old</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Note: Kids must be accompanied by a parent/guardian
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-700 dark:text-gray-300">
                    Mark as featured (popular) package
                  </label>
                </div>

                {/* Price Preview */}
                {formData.tokens && formData.price && (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-600">
                    <div className="text-center">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Price per Token</div>
                      <div className="mt-1 text-3xl font-bold text-brand-600 dark:text-brand-400">
                        ${(parseFloat(formData.price) / parseInt(formData.tokens)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 p-6 dark:border-gray-800">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPanel(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.tokens || !formData.price || !formData.validityDays}
                  className="flex-1 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {editingPackage ? "Save Changes" : "Create Package"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
