"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useBlogMutations, useBlogPosts } from "@/hooks/useBlogPosts";
import { useToast } from "@/components/ui/Toast";
import type { BlogPostRow } from "@/lib/blog-utils";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function BlogListPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const { data: allPosts = [], isLoading, refetch } = useBlogPosts();
  const { deletePost } = useBlogMutations();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      published: allPosts.filter((p) => p.status === "published").length,
      draft: allPosts.filter((p) => p.status === "draft").length,
    }),
    [allPosts]
  );

  const posts = useMemo(() => {
    if (filter === "all") return allPosts;
    return allPosts.filter((p) => p.status === filter);
  }, [allPosts, filter]);

  const handleDelete = async (post: BlogPostRow) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeletingId(post.id);
    try {
      await deletePost.mutateAsync(post.id);
      showToast("Post deleted", "success");
      refetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Blog" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Blog posts</h2>
          <p className="text-sm text-gray-500">
            Create and publish articles for the public website.
          </p>
        </div>
        <Link href="/blog/new">
          <Button className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> New post
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "published", "draft"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              filter === key
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {key}
            {key === "published" ? ` (${counts.published})` : ""}
            {key === "draft" ? ` (${counts.draft})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading posts…</div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300" />
            <p className="text-gray-500">No blog posts yet.</p>
            <Link href="/blog/new">
              <Button>Create your first post</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {posts.map((post) => (
              <div key={post.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-16 sm:w-28 dark:bg-gray-800">
                  {post.featured_image_url ? (
                    <Image
                      src={post.featured_image_url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-white">{post.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.is_featured ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Featured</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-500">{post.excerpt || "No excerpt"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    /blog/{post.slug} · Updated {formatDate(post.updated_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/blog/${post.id}/edit`}>
                    <Button variant="outline" className="inline-flex items-center gap-1">
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="text-red-600"
                    disabled={deletingId === post.id}
                    onClick={() => handleDelete(post)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
