"use client";

type SeoPreviewProps = {
  title: string;
  description: string;
  slug: string;
  imageUrl?: string | null;
  siteUrl?: string;
};

export function SeoPreview({ title, description, slug, imageUrl, siteUrl }: SeoPreviewProps) {
  const base = siteUrl || process.env.NEXT_PUBLIC_WEB_APP_URL || "https://onestepfitness.sg";
  const url = `${base.replace(/\/$/, "")}/blog/${slug || "your-post-slug"}`;
  const displayTitle = title || "Your blog post title";
  const displayDesc =
    description ||
    "Add a meta description to help search engines and social previews understand your post.";

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Google preview</p>
        <p className="truncate text-sm text-[#202124] dark:text-gray-300">{url}</p>
        <p className="mt-1 text-xl text-[#1a0dab] dark:text-blue-400">{displayTitle}</p>
        <p className="mt-1 line-clamp-2 text-sm text-[#4d5156] dark:text-gray-400">{displayDesc}</p>
      </div>

      <div className="rounded-[20px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Social preview</p>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-gray-800">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="flex aspect-[1.91/1] items-center justify-center bg-gray-100 text-sm text-gray-400 dark:bg-gray-800">
              Featured or OG image
            </div>
          )}
          <div className="bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="truncate text-xs uppercase text-gray-500">{base.replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 line-clamp-2 font-semibold text-gray-900 dark:text-white">{displayTitle}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{displayDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
