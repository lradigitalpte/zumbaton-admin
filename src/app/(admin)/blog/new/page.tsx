"use client";

import { useRouter } from "next/navigation";
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
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">New post</h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">Write the article, add an image, then save a draft or publish it.</p>
      </div>
      <BlogEditorForm saving={saving} onSave={handleSave} onCancel={() => router.push("/blog")} />
    </div>
  );
}
