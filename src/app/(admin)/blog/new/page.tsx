"use client";

import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { BlogEditorForm, formToPayload } from "@/components/blog/BlogEditorForm";
import { useBlogMutations } from "@/hooks/useBlogPosts";
import { useToast } from "@/components/ui/Toast";
import type { BlogFormValues } from "@/components/blog/BlogEditorForm";
import type { BlogPostStatus } from "@/lib/blog-utils";
import { useState } from "react";

export default function NewBlogPostPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { createPost } = useBlogMutations();
  const [saving, setSaving] = useState(false);

  const handleSave = async (form: BlogFormValues, status: BlogPostStatus) => {
    setSaving(true);
    try {
      const post = await createPost.mutateAsync(formToPayload(form, status));
      showToast(status === "published" ? "Post published" : "Draft saved", "success");
      if (post?.id) router.push(`/blog/${post.id}/edit`);
      else router.push("/blog");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="New blog post" />
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create blog post</h2>
        <p className="text-sm text-gray-500">Write your article, add images and SEO, then publish to the website.</p>
      </div>
      <BlogEditorForm saving={saving} onSave={handleSave} onCancel={() => router.push("/blog")} />
    </div>
  );
}
