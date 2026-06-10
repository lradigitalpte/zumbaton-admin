"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import Button from "@/components/ui/button/Button";
import { RichTextEditor } from "@/components/blog/RichTextEditor";
import { SeoPreview } from "@/components/blog/SeoPreview";
import { slugifyTitle } from "@/lib/blog-utils";
import type { BlogPostRow, BlogPostStatus } from "@/lib/blog-utils";
import { supabase } from "@/lib/supabase";
import { ImageIcon, Loader2, Save, Send } from "lucide-react";

export type BlogFormValues = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  featured_image_url: string;
  author_name: string;
  author_image_url: string;
  author_designation: string;
  tags: string;
  seo_title: string;
  seo_description: string;
  og_image_url: string;
  is_featured: boolean;
  status: BlogPostStatus;
};

export const emptyBlogForm = (): BlogFormValues => ({
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  featured_image_url: "",
  author_name: "One Step Fitness",
  author_image_url: "",
  author_designation: "Fitness Team",
  tags: "",
  seo_title: "",
  seo_description: "",
  og_image_url: "",
  is_featured: false,
  status: "draft",
});

export function blogRowToForm(post: BlogPostRow): BlogFormValues {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    featured_image_url: post.featured_image_url || "",
    author_name: post.author_name,
    author_image_url: post.author_image_url || "",
    author_designation: post.author_designation || "",
    tags: (post.tags || []).join(", "),
    seo_title: post.seo_title || "",
    seo_description: post.seo_description || "",
    og_image_url: post.og_image_url || "",
    is_featured: post.is_featured,
    status: post.status,
  };
}

export function formToPayload(form: BlogFormValues, status?: BlogPostStatus) {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || slugifyTitle(form.title),
    excerpt: form.excerpt.trim(),
    body: form.body,
    featured_image_url: form.featured_image_url.trim() || null,
    author_name: form.author_name.trim() || "One Step Fitness",
    author_image_url: form.author_image_url.trim() || null,
    author_designation: form.author_designation.trim() || null,
    tags: form.tags,
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
    og_image_url: form.og_image_url.trim() || null,
    is_featured: form.is_featured,
    status: status ?? form.status,
  };
}

type BlogEditorFormProps = {
  initial?: BlogFormValues;
  saving?: boolean;
  onSave: (form: BlogFormValues, status: BlogPostStatus) => void | Promise<void>;
  onCancel?: () => void;
};

async function uploadBlogImage(file: File, folder: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/blog/upload-image", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Upload failed");
  }
  return json.data.url as string;
}

export function BlogEditorForm({ initial, saving, onSave, onCancel }: BlogEditorFormProps) {
  const [form, setForm] = useState<BlogFormValues>(initial ?? emptyBlogForm());
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const seoTitle = form.seo_title || form.title;
  const seoDescription = form.seo_description || form.excerpt;
  const ogImage = form.og_image_url || form.featured_image_url;

  const charCounts = useMemo(
    () => ({
      title: seoTitle.length,
      description: seoDescription.length,
    }),
    [seoTitle, seoDescription]
  );

  const setField = <K extends keyof BlogFormValues>(key: K, value: BlogFormValues[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugTouched) {
        next.slug = slugifyTitle(String(value));
      }
      return next;
    });
  };

  const handleFeaturedUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingFeatured(true);
    try {
      const url = await uploadBlogImage(file, "featured");
      setField("featured_image_url", url);
    } finally {
      setUploadingFeatured(false);
    }
  };

  const handleOgUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingOg(true);
    try {
      const url = await uploadBlogImage(file, "og");
      setField("og_image_url", url);
    } finally {
      setUploadingOg(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Post content</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. 5 Tips for Your First Zumba Class"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">URL slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">/blog/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setField("slug", slugifyTitle(e.target.value));
                  }}
                  placeholder="your-post-slug"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setField("excerpt", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                placeholder="Short summary shown on the blog listing and search previews."
              />
              <p className="mt-1 text-xs text-gray-500">{form.excerpt.length}/300 recommended</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Article body</h3>
            <p className="mt-1 text-sm text-gray-500">
              Rich text editor — format with the toolbar. What you see is what appears on the website.
            </p>
          </div>
          <RichTextEditor
            value={form.body}
            onChange={(html) => setField("body", html)}
            onUploadImage={(file) => uploadBlogImage(file, "content")}
            placeholder="Start writing your article…"
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Author & tags</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Author name</label>
              <Input value={form.author_name} onChange={(e) => setField("author_name", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Author role</label>
              <Input
                value={form.author_designation}
                onChange={(e) => setField("author_designation", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
              <Input
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
                placeholder="fitness, zumba, wellness"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Featured image</h3>
          {form.featured_image_url ? (
            <div className="relative mb-3 aspect-video overflow-hidden rounded-lg">
              <Image src={form.featured_image_url} alt="Featured" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-600">
            {uploadingFeatured ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Upload image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadingFeatured}
              onChange={(e) => handleFeaturedUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          <Input
            className="mt-3"
            value={form.featured_image_url}
            onChange={(e) => setField("featured_image_url", e.target.value)}
            placeholder="Or paste image URL"
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">SEO</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Meta title</label>
              <Input
                value={form.seo_title}
                onChange={(e) => setField("seo_title", e.target.value)}
                placeholder={form.title || "Defaults to post title"}
              />
              <p className="mt-1 text-xs text-gray-500">{charCounts.title}/60</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Meta description</label>
              <textarea
                value={form.seo_description}
                onChange={(e) => setField("seo_description", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                placeholder={form.excerpt || "Defaults to excerpt"}
              />
              <p className="mt-1 text-xs text-gray-500">{charCounts.description}/160</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">OG image (optional)</label>
              <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-sm text-brand-600">
                {uploadingOg ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upload OG image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingOg}
                  onChange={(e) => handleOgUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              <Input
                value={form.og_image_url}
                onChange={(e) => setField("og_image_url", e.target.value)}
                placeholder="Defaults to featured image"
              />
            </div>
          </div>
          <div className="mt-5">
            <SeoPreview
              title={seoTitle}
              description={seoDescription}
              slug={form.slug}
              imageUrl={ogImage}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setField("is_featured", e.target.checked)}
            />
            Feature on blog homepage
          </label>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              disabled={saving || !form.title.trim()}
              onClick={() => onSave(form, "draft")}
              className="w-full justify-center"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save draft
            </Button>
            <Button
              disabled={saving || !form.title.trim()}
              onClick={() => onSave(form, "published")}
              className="w-full justify-center"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publish
            </Button>
            {onCancel ? (
              <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
