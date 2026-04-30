"use client";

import Image from "next/image";

type BrandLogoProps = {
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({
  alt = "One Step Fitness Logo",
  width,
  height,
  className = "",
  priority = false,
}: BrandLogoProps) {
  return (
    <>
      <Image
        src="/images/logo/one step fitness black.png"
        alt={alt}
        width={width}
        height={height}
        className={`${className} dark:hidden`}
        priority={priority}
      />
      <Image
        src="/images/logo/One step fitness logo.png"
        alt={alt}
        width={width}
        height={height}
        className={`${className} hidden dark:block`}
        priority={priority}
      />
    </>
  );
}
