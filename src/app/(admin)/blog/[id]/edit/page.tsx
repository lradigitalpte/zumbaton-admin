"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
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
    return <div className="p-8 text-center text-gray-500">Loading post…</div>;
  }

  if (error || !post) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Post not found.</p>
        <button type="button" className="mt-4 text-brand-600" onClick={() => router.push("/blog")}>
          Back to blog
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Edit blog post" />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{post.title}</h2>
          <p className="text-sm text-gray-500">Status: {post.status}</p>
        </div>
        {post.status === "published" ? (
          <a
            href={`${process.env.NEXT_PUBLIC_WEB_APP_URL || "https://onestepfitness.sg"}/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View on website →
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
