"use client";

import { useState, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { 
  useClassCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  ClassCategory
} from "@/hooks/useClassCategories";
import CategoryCreatePanel from "@/components/categories/CategoryCreatePanel";

export default function CategoriesPage() {
  const [showPanel, setShowPanel] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ClassCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ClassCategory | null>(null);

  // API Hooks
  const { data: categories = [], isLoading, refetch } = useClassCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Stats
  const stats = useMemo(() => {
    const activeCategories = categories.filter((c) => c.isActive).length;
    const inactiveCategories = categories.filter((c) => !c.isActive).length;
    const totalCategories = categories.length;
    return { activeCategories, inactiveCategories, totalCategories };
  }, [categories]);

  const openNewCategoryPanel = () => {
    setEditingCategory(null);
    setShowPanel(true);
  };

  const openEditPanel = (category: ClassCategory) => {
    setEditingCategory(category);
    setShowPanel(true);
  };

  const handleCategorySaved = async (categoryId?: string) => {
    setShowPanel(false);
    setEditingCategory(null);
    await refetch();
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      await deleteCategoryMutation.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
      await refetch();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const toggleCategoryStatus = async (category: ClassCategory) => {
    try {
      await updateCategoryMutation.mutateAsync({
        id: category.id,
        data: { isActive: !category.isActive },
      });
      await refetch();
    } catch (error) {
      console.error('Error toggling category status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb 
        paths={[
          { label: "Home", href: "/" },
          { label: "Categories", href: "/categories" },
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <ComponentCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Categories</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalCategories}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.activeCategories}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">
                {stats.inactiveCategories}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </ComponentCard>
      </div>

      {/* Categories List */}
      <ComponentCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Categories</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your class categories
            </p>
          </div>
          <Button onClick={openNewCategoryPanel} variant="primary">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Category
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <span className="ml-3 text-gray-500">Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No categories</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new category.
            </p>
            <div className="mt-6">
              <Button onClick={openNewCategoryPanel} variant="primary">
                Add Category
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`rounded-xl border p-5 transition-all ${
                  category.isActive
                    ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${category.color || '#f59e0b'}20` }}
                    >
                      <svg className="h-6 w-6" style={{ color: category.color || '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {category.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {category.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleCategoryStatus(category)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        category.isActive
                          ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      title={category.isActive ? "Deactivate" : "Activate"}
                    >
                      {category.isActive ? (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {category.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {category.description}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => openEditPanel(category)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingCategory(category)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ComponentCard>

      {/* Category Create/Edit Panel */}
      <CategoryCreatePanel
        isOpen={showPanel}
        onClose={() => {
          setShowPanel(false);
          setEditingCategory(null);
        }}
        editingCategory={editingCategory}
        onCategorySaved={handleCategorySaved}
      />

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Category
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>{deletingCategory.name}</strong>? This action cannot be undone.
              {deletingCategory.isActive && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Note: This category is currently active.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeletingCategory(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDelete}
                disabled={deleteCategoryMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
            {deleteCategoryMutation.isError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {deleteCategoryMutation.error?.message || "Failed to delete category"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

