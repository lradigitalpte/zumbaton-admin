"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useBlogMutations, useBlogPosts } from "@/hooks/useBlogPosts";
import { useToast } from "@/components/ui/Toast";
import type { BlogPostRow } from "@/lib/blog-utils";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[148px] flex-col rounded-[28px] p-5 text-left sm:p-6";

function formatDate(iso: string | null) {
  if (!iso) return "Not dated";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(new Date(iso));
}

export default function BlogListPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const { data: allPosts = [], isLoading, refetch } = useBlogPosts();
  const { deletePost } = useBlogMutations();
  const [deleteTarget, setDeleteTarget] = useState<BlogPostRow | null>(null);

  const counts = useMemo(
    () => ({
      published: allPosts.filter((post) => post.status === "published").length,
      draft: allPosts.filter((post) => post.status === "draft").length,
    }),
    [allPosts]
  );

  const posts = useMemo(() => {
    if (filter === "all") return allPosts;
    return allPosts.filter((post) => post.status === filter);
  }, [allPosts, filter]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePost.mutateAsync(deleteTarget.id);
      showToast("Post deleted", "success");
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Delete failed", "error");
    }
  };

  const filters = [
    { key: "all" as const, label: "All posts", value: allPosts.length, caption: "Published and drafts" },
    { key: "published" as const, label: "Published", value: counts.published, caption: "Live on the website" },
    { key: "draft" as const, label: "Drafts", value: counts.draft, caption: "Not on the website yet" },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Blog</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">Articles for the public website. Published posts are live. Drafts stay in the admin.</p>
        </div>
        <Link href="/blog/new" className="rounded-full bg-[#E4F56C] px-4 py-2 text-center text-xs font-semibold text-neutral-950">
          New post
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`${metric} ${selected ? "border border-[#d5e45c] bg-[#E4F56C] text-neutral-950" : "border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white"}`}
            >
              <p className={`text-sm font-medium ${selected ? "" : "text-neutral-600 dark:text-white/70"}`}>{item.label}</p>
              <p className="mt-4 text-4xl font-semibold leading-none tracking-tight">{isLoading ? "—" : item.value}</p>
              <p className={`mt-2 text-xs ${selected ? "text-neutral-950/60" : "text-neutral-400"}`}>{item.caption}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => <div key={item} className={`${card} h-32 animate-pulse`} />)}
        </div>
      ) : posts.length === 0 ? (
        <section className={`${card} px-6 py-12 text-center`}>
          <p className="text-sm font-medium text-neutral-950 dark:text-white">{filter === "all" ? "No blog posts yet" : `No ${filter} posts`}</p>
          <p className="mt-1 text-sm text-neutral-500">Write one and publish it when it is ready.</p>
          <Link href="/blog/new" className="mt-4 inline-flex rounded-full bg-[#E4F56C] px-4 py-2 text-xs font-semibold text-neutral-950">
            New post
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className={`${card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5`}>
              <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-[20px] bg-neutral-100 sm:h-24 sm:w-36 dark:bg-white/10">
                {post.featured_image_url ? (
                  <Image src={post.featured_image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">No image</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">{post.title}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${post.status === "published" ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}>
                    {post.status === "published" ? "Published" : "Draft"}
                  </span>
                  {post.is_featured ? (
                    <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-950">Featured</span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{post.excerpt || "No excerpt yet."}</p>
                <p className="mt-2 text-xs text-neutral-400">/blog/{post.slug} · Updated {formatDate(post.updated_at)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/blog/${post.id}/edit`} className="rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(post)}
                  className="rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => !deletePost.isPending && setDeleteTarget(null)} />
          <div className={`${card} relative w-full max-w-md p-6`} onClick={(event) => event.stopPropagation()}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-red-500">Delete</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">Remove this post?</h2>
            <p className="mt-2 text-sm text-neutral-500">{deleteTarget.title} will leave the website and this list.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deletePost.isPending} className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {deletePost.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
