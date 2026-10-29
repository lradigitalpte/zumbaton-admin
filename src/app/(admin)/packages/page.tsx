"use client";

import { useState, useMemo, useEffect } from "react";
import StudioMenu from "@/components/ui/StudioMenu";
import { useAuth } from "@/context/AuthContext";
import { 
  usePackages, 
  useCreatePackage, 
  useUpdatePackage, 
  useTogglePackageStatus,
  PackageWithStats 
} from "@/hooks/usePackages";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white";
const eyebrow = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400";
const pillOn = "rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white";
const pillOff = "rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:bg-white/10 dark:text-white";

export default function PackagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  const [showPanel, setShowPanel] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageWithStats | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackageWithStats | null>(null);
  const [packageTypeTab, setPackageTypeTab] = useState<"all" | "adult" | "kid">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tokens: "",
    price: "",
    validityDays: "",
    packageType: "adult" as "adult" | "kid" | "all",
    ageRequirement: "all" as "all" | "5-12" | "13+",
    isFeatured: false,
    isUnlimited: false,
  });
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // API Hooks
  const { data: packagesData, isLoading, error, refetch } = usePackages();
  const createPackageMutation = useCreatePackage();
  const updatePackageMutation = useUpdatePackage();
  const toggleStatusMutation = useTogglePackageStatus();

  // Get packages from API response
  const packages = packagesData?.packages || [];
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (!showArchived && !pkg.isActive) return false;
      if (packageTypeTab === "all") return true;
      if (packageTypeTab === "adult") return pkg.packageType === "adult" || pkg.packageType === "all";
      return pkg.packageType === "kid" || pkg.packageType === "all";
    });
  }, [packages, packageTypeTab, showArchived]);

  // Stats
  const stats = useMemo(() => {
    const activePackages = packages.filter((p) => p.isActive).length;
    const totalSales = packages.reduce((sum, pkg) => sum + (pkg.salesCount || 0), 0);
    const totalRevenue = packages.reduce((sum, pkg) => sum + (pkg.revenue || 0), 0);
    const limitedPackages = packages.filter((pkg) => !pkg.isUnlimited);
    const avgTokenPrice = limitedPackages.length > 0
      ? limitedPackages.reduce((sum, pkg) => sum + ((pkg.priceCents / 100) / pkg.tokenCount), 0) / limitedPackages.length
      : 0;
    return { activePackages, totalSales, totalRevenue, avgTokenPrice };
  }, [packages]);

  const openNewPackagePanel = () => {
    setEditingPackage(null);
    setFormData({ name: "", description: "", tokens: "", price: "", validityDays: "30", packageType: "adult", ageRequirement: "all", isFeatured: false, isUnlimited: false });
    setShowPanel(true);
  };

  const openEditPanel = (pkg: PackageWithStats) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      tokens: pkg.isUnlimited ? "1" : pkg.tokenCount.toString(),
      price: (pkg.priceCents / 100).toString(),
      validityDays: pkg.validityDays.toString(),
      packageType: (pkg.packageType as "adult" | "kid" | "all") || "adult",
      ageRequirement: (pkg.ageRequirement as "all" | "5-12" | "13+") || "all",
      isFeatured: false, // Note: isFeatured is not in the schema, keeping for UI
      isUnlimited: pkg.isUnlimited || false,
    });
    setShowPanel(true);
  };

  const handleSave = async () => {
    try {
      const packageData = {
        name: formData.name,
        description: formData.description || undefined,
        tokenCount: formData.isUnlimited ? 1 : parseInt(formData.tokens),
        priceCents: Math.round(parseFloat(formData.price) * 100),
        validityDays: parseInt(formData.validityDays),
        packageType: formData.packageType,
        ageRequirement: formData.packageType === "kid" ? formData.ageRequirement : "all",
        currency: "SGD",
        isUnlimited: formData.isUnlimited,
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

  const restorePackage = async (pkg: PackageWithStats) => {
    try {
      await toggleStatusMutation.mutateAsync({ id: pkg.id, isActive: true });
      refetch();
    } catch (err) {
      console.error("Error restoring package:", err);
    }
  };

  const confirmSoftDelete = async () => {
    if (!deleteTarget) return;
    try {
      await toggleStatusMutation.mutateAsync({ id: deleteTarget.id, isActive: false });
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      console.error("Error soft deleting package:", err);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showPanel || deleteTarget) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showPanel, deleteTarget]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteTarget) setDeleteTarget(null);
      else if (showPanel) setShowPanel(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showPanel, deleteTarget]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${card} flex flex-col items-center justify-center px-6 py-20 text-center`}>
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">Could not load packages</h3>
        <p className="mt-2 text-sm text-neutral-500">{(error as Error).message}</p>
        <button onClick={() => refetch()} className="mt-5 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Try again</button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">Token packages</h1>
          <p className="mt-1 text-sm text-neutral-500">Prices, tokens, and how each pack is selling.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "adult", "kid"] as const).map((tab) => (
            <button key={tab} onClick={() => setPackageTypeTab(tab)} className={packageTypeTab === tab ? pillOn : pillOff}>
              {tab === "all" ? "All" : tab === "adult" ? "Adults" : "Kids"}
            </button>
          ))}
          <button onClick={() => setShowArchived((prev) => !prev)} className={showArchived ? "rounded-full bg-[#E4F56C] px-3.5 py-2 text-xs font-semibold text-neutral-950" : pillOff}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          <div className="flex items-center rounded-full bg-neutral-100 p-1 dark:bg-white/10">
            {(["cards", "table"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${viewMode === mode ? "bg-neutral-950 text-white" : "text-neutral-500"}`}>
                {mode === "table" ? "Table" : "Cards"}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={openNewPackagePanel} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]">Add package</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Packages", value: filteredPackages.length, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "Active", value: stats.activePackages, tone: "bg-[#E4F56C] text-neutral-950" },
          { label: "Sales", value: stats.totalSales.toLocaleString(), tone: "bg-neutral-950 text-white" },
          { label: "Revenue", value: `$${stats.totalRevenue.toLocaleString()}`, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-[28px] border border-neutral-200/80 p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 ${stat.tone}`}>
            <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPackages.length === 0 && (
        <div className={`${card} px-6 py-16 text-center`}>
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">No packages in this view</h3>
          <p className="mt-2 text-sm text-neutral-500">Create a pack, or turn on archived to see hidden ones.</p>
          {isAdmin && <button onClick={openNewPackagePanel} className="mt-5 rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950">Add package</button>}
        </div>
      )}

      {/* Package Cards View */}
      {viewMode === "cards" && filteredPackages.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPackages.map((pkg) => {
            const price = pkg.priceCents / 100;
            const audience = pkg.packageType === "kid" ? "Kids" : pkg.packageType === "all" ? "Everyone" : "Adults";
            return (
              <article key={pkg.id} className={`${card} flex flex-col p-5 ${pkg.isActive ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pkg.packageType === "kid" ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-[#E4F56C]"}`}>{audience}</span>
                      {pkg.packageType === "kid" && pkg.ageRequirement && pkg.ageRequirement !== "all" && (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{pkg.ageRequirement}</span>
                      )}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pkg.isActive ? "bg-neutral-100 text-neutral-700" : "bg-neutral-200 text-neutral-500"}`}>{pkg.isActive ? "Active" : "Archived"}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{pkg.name}</h3>
                    <p className="mt-1 text-sm text-neutral-500">{pkg.description}</p>
                  </div>
                  <p className="shrink-0 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">${price.toFixed(2)}</p>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-neutral-950 px-3 py-3 text-white">
                    <p className="text-2xl font-semibold">{pkg.isUnlimited ? "∞" : pkg.tokenCount}</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">{pkg.isUnlimited ? "Unlimited" : "Tokens"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#E4F56C] px-3 py-3 text-neutral-950">
                    <p className="text-lg font-semibold">{pkg.isUnlimited ? "—" : `$${(price / pkg.tokenCount).toFixed(2)}`}</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">Per token</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 px-3 py-3 dark:bg-white/5">
                    <p className="text-lg font-semibold text-neutral-950 dark:text-white">{pkg.validityDays}</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Days</p>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between text-sm">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Sales</p>
                    <p className="text-lg font-semibold text-neutral-950 dark:text-white">{pkg.salesCount || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Revenue</p>
                    <p className="text-lg font-semibold text-neutral-950 dark:text-white">${(pkg.revenue || 0).toLocaleString()}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => openEditPanel(pkg)} className="flex-1 rounded-full bg-neutral-950 py-2.5 text-sm font-semibold text-white">Edit</button>
                    <button onClick={() => pkg.isActive ? setDeleteTarget(pkg) : restorePackage(pkg)} className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${pkg.isActive ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#E4F56C] text-neutral-950"}`}>
                      {pkg.isActive ? "Soft delete" : "Restore"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {viewMode === "table" && filteredPackages.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Tokens</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Per token</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {filteredPackages.map((pkg) => {
                  const price = pkg.priceCents / 100;
                  return (
                    <tr key={pkg.id} className={pkg.isActive ? "hover:bg-neutral-50 dark:hover:bg-white/5" : "opacity-60"}>
                      <td className="px-4 py-4">
                        <p className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{pkg.name}</p>
                        <p className="max-w-xs truncate text-neutral-500">{pkg.description}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pkg.packageType === "kid" ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-[#E4F56C]"}`}>
                            {pkg.packageType === "kid" ? "Kids" : pkg.packageType === "all" ? "Everyone" : "Adults"}
                          </span>
                          {pkg.packageType === "kid" && pkg.ageRequirement && pkg.ageRequirement !== "all" && (
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{pkg.ageRequirement}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-neutral-950 dark:text-white">{pkg.isUnlimited ? "Unlimited" : pkg.tokenCount}</td>
                      <td className="px-4 py-4 text-neutral-950 dark:text-white">${price.toFixed(2)}</td>
                      <td className="px-4 py-4 text-neutral-500">{pkg.isUnlimited ? "—" : `$${(price / pkg.tokenCount).toFixed(2)}`}</td>
                      <td className="px-4 py-4 text-neutral-500">{pkg.validityDays} days</td>
                      <td className="px-4 py-4 font-semibold text-neutral-950 dark:text-white">{pkg.salesCount || 0}</td>
                      <td className="px-4 py-4 font-semibold text-neutral-950 dark:text-white">${(pkg.revenue || 0).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pkg.isActive ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-500"}`}>{pkg.isActive ? "Active" : "Archived"}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isAdmin ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEditPanel(pkg)} className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">Edit</button>
                            <button onClick={() => pkg.isActive ? setDeleteTarget(pkg) : restorePackage(pkg)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pkg.isActive ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#E4F56C] text-neutral-950"}`}>{pkg.isActive ? "Soft delete" : "Restore"}</button>
                          </div>
                        ) : <span className="text-neutral-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPanel && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => setShowPanel(false)} />
          <div className={`${card} relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Token packages</p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{editingPackage ? "Edit package" : "New package"}</h2>
              </div>
              <button onClick={() => setShowPanel(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-2">
              <div>
                <label className={eyebrow}>Package name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Starter Pack" className={field} />
              </div>
              <div>
                <label className={eyebrow}>Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Great for beginners" className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={eyebrow}>Tokens</label>
                  <input type="number" min="1" value={formData.tokens} disabled={formData.isUnlimited} onChange={(e) => setFormData({ ...formData, tokens: e.target.value })} placeholder="10" className={field} />
                </div>
                <div>
                  <label className={eyebrow}>Price (SGD)</label>
                  <input type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="80.00" className={field} />
                </div>
              </div>
              <div>
                <label className={eyebrow}>Validity (days)</label>
                <input type="number" min="1" value={formData.validityDays} onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })} placeholder="180" className={field} />
              </div>
              <div>
                <label className={eyebrow}>Package type</label>
                <StudioMenu
                  value={formData.packageType}
                  onChange={(value) => setFormData({ ...formData, packageType: value as "adult" | "kid" | "all" })}
                  placeholder="Package type"
                  options={[
                    { value: "adult", label: "Adult" },
                    { value: "kid", label: "Kid" },
                    { value: "all", label: "All (adult and kid)" },
                  ]}
                />
              </div>
              {formData.packageType === "kid" && (
                <div>
                  <label className={eyebrow}>Age requirement</label>
                  <StudioMenu
                    value={formData.ageRequirement}
                    onChange={(value) => setFormData({ ...formData, ageRequirement: value as "all" | "5-12" | "13+" })}
                    placeholder="Age"
                    options={[
                      { value: "all", label: "All ages" },
                      { value: "5-12", label: "5–12 years" },
                      { value: "13+", label: "13+ years" },
                    ]}
                  />
                  <p className="mt-2 text-xs text-neutral-500">Kids must be accompanied by a parent or guardian.</p>
                </div>
              )}
              <button type="button" onClick={() => setFormData({ ...formData, isUnlimited: !formData.isUnlimited, tokens: !formData.isUnlimited ? "1" : formData.tokens })} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${formData.isUnlimited ? "bg-neutral-950 text-white" : "bg-neutral-50 text-neutral-700 dark:bg-white/5 dark:text-white"}`}>
                <span>Unlimited package</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${formData.isUnlimited ? "bg-[#E4F56C] text-neutral-950" : "bg-white text-neutral-500"}`}>{formData.isUnlimited ? "On" : "Off"}</span>
              </button>
              <button type="button" onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${formData.isFeatured ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-50 text-neutral-700 dark:bg-white/5 dark:text-white"}`}>
                <span>Featured package</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${formData.isFeatured ? "bg-neutral-950 text-[#E4F56C]" : "bg-white text-neutral-500"}`}>{formData.isFeatured ? "On" : "Off"}</span>
              </button>
              {!formData.isUnlimited && formData.tokens && formData.price && (
                <div className="rounded-2xl bg-[#E4F56C] px-4 py-4 text-neutral-950">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">Price per token</p>
                  <p className="mt-1 text-3xl font-semibold">${(parseFloat(formData.price) / parseInt(formData.tokens)).toFixed(2)}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-5">
              <button onClick={() => setShowPanel(false)} className="flex-1 rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!formData.name || (!formData.isUnlimited && !formData.tokens) || !formData.price || !formData.validityDays}
                className="flex-1 rounded-full bg-[#E4F56C] py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingPackage ? "Save changes" : "Create package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => setDeleteTarget(null)} />
          <div className={`${card} relative w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-red-500">Soft delete</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">Hide {deleteTarget.name}?</h2>
            <p className="mt-2 text-sm text-neutral-500">It will leave the default list. You can bring it back later from Show archived.</p>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button onClick={confirmSoftDelete} disabled={toggleStatusMutation.isPending} className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {toggleStatusMutation.isPending ? "Hiding…" : "Soft delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
