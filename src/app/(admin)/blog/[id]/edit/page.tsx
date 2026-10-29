"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { BlogEditorForm, blogRowToForm, formToPayload } from "@/components/blog/BlogEditorForm";
import { useBlogMutations, useBlogPost } from "@/hooks/useBlogPosts";
import { useToast } from "@/components/ui/Toast";
import type { BlogFormValues } from "@/components/blog/BlogEditorForm";
import type { BlogPostStatus } from "@/lib/blog-utils";
import { useState } from "react";

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const { data: post, isLoading, error } = useBlogPost(id);
  const { updatePost } = useBlogMutations();
  const [saving, setSaving] = useState(false);

  const handleSave = async (form: BlogFormValues, status: BlogPostStatus) => {
    setSaving(true);
    try {
      await updatePost.mutateAsync({ id, body: formToPayload(form, status) });
      showToast(status === "published" ? "Post published" : "Draft saved", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-[28px] border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800" />;
  }

  if (error || !post) {
    return (
      <div className="rounded-[28px] border border-neutral-200/80 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-gray-800">
        <p className="text-sm text-neutral-500">This post could not be found.</p>
        <button type="button" className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white" onClick={() => router.push("/blog")}>
          Back to blog
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">{post.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{post.status === "published" ? "Published on the website" : "Draft, not on the website yet"}</p>
        </div>
        {post.status === "published" ? (
          <a
            href={`${process.env.NEXT_PUBLIC_WEB_APP_URL || "https://onestepfitness.sg"}/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-neutral-950 px-4 py-2 text-center text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
          >
            View on website
          </a>
        ) : null}
      </div>
      <BlogEditorForm
        initial={blogRowToForm(post)}
        saving={saving}
        onSave={handleSave}
        onCancel={() => router.push("/blog")}
      />
    </div>
  );
}
