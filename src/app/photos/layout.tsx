import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class Photo Shot List | One Step Fitness",
  description:
    "Production brief for One Step Fitness's photographer: which classes need new portrait photos, the exact shots to capture, and the technical specs the site requires.",
};

export default function PhotosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
