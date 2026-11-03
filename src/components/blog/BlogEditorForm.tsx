"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { RichTextEditor } from "@/components/blog/RichTextEditor";
import { SeoPreview } from "@/components/blog/SeoPreview";
import { slugifyTitle } from "@/lib/blog-utils";
import type { BlogPostRow, BlogPostStatus } from "@/lib/blog-utils";
import { supabase } from "@/lib/supabase";

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

const card = "rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6";
const label = "mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90";
const field = "h-11 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white";
const area = "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white";

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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Post</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className={label}>Title</label>
              <input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. 5 Tips for Your First Zumba Class" className={field} />
            </div>
            <div>
              <label className={label}>URL slug</label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-neutral-500">/blog/</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setField("slug", slugifyTitle(event.target.value));
                  }}
                  placeholder="your-post-slug"
                  className={field}
                />
              </div>
            </div>
            <div>
              <label className={label}>Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(event) => setField("excerpt", event.target.value)}
                rows={3}
                className={area}
                placeholder="Short summary on the blog list and in search."
              />
              <p className="mt-2 text-xs text-neutral-400">{form.excerpt.length}/300 recommended</p>
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Article</h2>
          <p className="mt-1 text-sm text-neutral-500">Use the toolbar. This is what appears on the website.</p>
          <div className="mt-4">
            <RichTextEditor
              value={form.body}
              onChange={(html) => setField("body", html)}
              onUploadImage={(file) => uploadBlogImage(file, "content")}
              placeholder="Start writing your article…"
            />
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Author and tags</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Author name</label>
              <input value={form.author_name} onChange={(event) => setField("author_name", event.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Author role</label>
              <input value={form.author_designation} onChange={(event) => setField("author_designation", event.target.value)} className={field} />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Tags</label>
              <input value={form.tags} onChange={(event) => setField("tags", event.target.value)} placeholder="fitness, zumba, wellness" className={field} />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Featured image</h2>
          {form.featured_image_url ? (
            <div className="relative mt-4 aspect-video overflow-hidden rounded-[20px]">
              <Image src={form.featured_image_url} alt="" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="mt-4 flex aspect-video items-center justify-center rounded-[20px] bg-neutral-100 text-xs text-neutral-400 dark:bg-white/10">No image yet</div>
          )}
          <label className="mt-4 inline-flex cursor-pointer rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
            {uploadingFeatured ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadingFeatured}
              onChange={(event) => handleFeaturedUpload(event.target.files?.[0] ?? null)}
            />
          </label>
          <input
            value={form.featured_image_url}
            onChange={(event) => setField("featured_image_url", event.target.value)}
            placeholder="Or paste an image URL"
            className={`${field} mt-3`}
          />
        </section>

        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Search and social</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className={label}>Meta title</label>
              <input value={form.seo_title} onChange={(event) => setField("seo_title", event.target.value)} placeholder={form.title || "Defaults to the post title"} className={field} />
              <p className={`mt-2 text-xs ${charCounts.title > 60 ? "text-red-500" : "text-neutral-400"}`}>{charCounts.title}/60</p>
            </div>
            <div>
              <label className={label}>Meta description</label>
              <textarea
                value={form.seo_description}
                onChange={(event) => setField("seo_description", event.target.value)}
                rows={3}
                className={area}
                placeholder={form.excerpt || "Defaults to the excerpt"}
              />
              <p className={`mt-2 text-xs ${charCounts.description > 160 ? "text-red-500" : "text-neutral-400"}`}>{charCounts.description}/160</p>
            </div>
            <div>
              <label className={label}>Social image</label>
              <label className="inline-flex cursor-pointer rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:bg-white/10 dark:text-white">
                {uploadingOg ? "Uploading…" : "Upload social image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingOg}
                  onChange={(event) => handleOgUpload(event.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={form.og_image_url}
                onChange={(event) => setField("og_image_url", event.target.value)}
                placeholder="Defaults to the featured image"
                className={`${field} mt-3`}
              />
            </div>
          </div>
          <div className="mt-5">
            <SeoPreview title={seoTitle} description={seoDescription} slug={form.slug} imageUrl={ogImage} />
          </div>
        </section>

        <section className={card}>
          <button
            type="button"
            onClick={() => setField("is_featured", !form.is_featured)}
            className={`w-full rounded-2xl px-4 py-3 text-left ${form.is_featured ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white"}`}
          >
            <span className="block text-sm font-semibold">{form.is_featured ? "Featured on the blog" : "Not featured"}</span>
            <span className={`mt-0.5 block text-xs ${form.is_featured ? "text-neutral-950/70" : "text-neutral-500"}`}>Shows this post on the blog homepage.</span>
          </button>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={saving || !form.title.trim()}
              onClick={() => onSave(form, "published")}
              className="rounded-full bg-[#E4F56C] py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Publish"}
            </button>
            <button
              type="button"
              disabled={saving || !form.title.trim()}
              onClick={() => onSave(form, "draft")}
              className="rounded-full bg-neutral-950 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            {onCancel ? (
              <button type="button" onClick={onCancel} className="rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-600 dark:border-white/10 dark:text-white">
                Cancel
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
