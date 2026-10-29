"use client";

import { useState, useEffect } from "react";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useCreateCategory, useUpdateCategory, ClassCategory } from "@/hooks/useClassCategories";

interface CategoryCreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: ClassCategory | null;
  onCategoryCreated?: (categoryId: string) => void;
  onCategorySaved?: (categoryId?: string) => void;
}

const colorOptions = [
  { value: "#f59e0b", label: "Amber", color: "bg-amber-500" },
  { value: "#ef4444", label: "Red", color: "bg-red-500" },
  { value: "#10b981", label: "Green", color: "bg-emerald-500" },
  { value: "#3b82f6", label: "Blue", color: "bg-blue-500" },
  { value: "#8b5cf6", label: "Purple", color: "bg-purple-500" },
  { value: "#ec4899", label: "Pink", color: "bg-pink-500" },
  { value: "#06b6d4", label: "Cyan", color: "bg-cyan-500" },
  { value: "#eab308", label: "Yellow", color: "bg-yellow-500" },
];


export default function CategoryCreatePanel({
  isOpen,
  onClose,
  editingCategory,
  onCategoryCreated,
  onCategorySaved,
}: CategoryCreatePanelProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#f59e0b",
    isActive: true,
  });

  // Load editing category data when panel opens
  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        description: editingCategory.description || "",
        color: editingCategory.color || "#f59e0b",
        isActive: editingCategory.isActive,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#f59e0b",
        isActive: true,
      });
    }
  }, [editingCategory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        const updatedCategory = await updateCategory.mutateAsync({
          id: editingCategory.id,
          data: {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            color: formData.color,
            isActive: formData.isActive,
          },
        });

        if (onCategorySaved) {
          onCategorySaved(updatedCategory.id);
        }
      } else {
        // Create new category
        const newCategory = await createCategory.mutateAsync({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
        });

        // Reset form
        setFormData({
          name: "",
          description: "",
          color: "#f59e0b",
          isActive: true,
        });

        // Notify parent
        if (onCategoryCreated) {
          onCategoryCreated(newCategory.id);
        }
        if (onCategorySaved) {
          onCategorySaved(newCategory.id);
        }
      }

      onClose();
    } catch (error) {
      console.error(`Failed to ${editingCategory ? 'update' : 'create'} category:`, error);
    }
  };

  const handleChange = (field: string) => (value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isPending = editingCategory ? updateCategory.isPending : createCategory.isPending;

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title={editingCategory ? "Edit Category" : "Create New Category"} size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="category-name">Category Name *</Label>
          <Input
            id="category-name"
            type="text"
            placeholder="e.g., Dance Fitness"
            value={formData.name}
            onChange={(e) => handleChange("name")(e.target.value)}
            className="!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Slug will be auto-generated from the name
          </p>
        </div>

        <div>
          <Label htmlFor="category-description">Description</Label>
          <textarea
            id="category-description"
            className="h-28 w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-hidden focus:ring-3 focus:ring-neutral-950/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
            placeholder="Brief description of this category..."
            value={formData.description}
            onChange={(e) => handleChange("description")(e.target.value)}
          />
        </div>

        <div>
          <Label>Color</Label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {colorOptions.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleChange("color")(color.value)}
                className={`h-12 rounded-full border-2 transition-all ${
                  formData.color === color.value
                    ? "scale-105 border-neutral-950 ring-2 ring-[#E4F56C] dark:border-white"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color.value }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        {editingCategory && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleChange("isActive")(e.target.checked.toString())}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <Label htmlFor="isActive" className="!mb-0 cursor-pointer">
              Active (visible in class creation)
            </Label>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-950 dark:border-white/10 dark:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!formData.name.trim() || isPending}
          >
            {isPending
              ? (editingCategory ? "Updating..." : "Creating...")
              : (editingCategory ? "Update Category" : "Create Category")
            }
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}

