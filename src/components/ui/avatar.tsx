"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { OnlineDot } from "./online-dot";

const GRADIENTS = [
  "from-[#ff9a4d] to-[#f0532c]",
  "from-[#f0532c] to-[#d9367a]",
  "from-[#9b84ff] to-[#7656f5]",
  "from-[#2fc6a0] to-[#178f7a]",
  "from-[#ffb547] to-[#f0782c]",
  "from-[#4fa3ff] to-[#5b5cf0]",
  "from-[#ff7aa8] to-[#c2408c]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SIZES = {
  xs: "size-7 text-[0.625rem]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
  "2xl": "size-28 text-3xl",
} as const;

const DOT_SIZES = { xs: "sm", sm: "sm", md: "md", lg: "md", xl: "lg", "2xl": "lg" } as const;

export interface AvatarProps {
  name: string;
  src?: string | null;
  seed?: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  className?: string;
  ring?: boolean;
}

/** Profile photo with a warm gradient + initials fallback and an optional presence dot. */
export function Avatar({ name, src, seed, size = "md", online, className, ring }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "relative inline-grid place-items-center overflow-hidden rounded-full font-display font-semibold text-white select-none",
          SIZES[size],
          !showImage && "bg-gradient-to-br",
          !showImage && GRADIENTS[hash(seed ?? name) % GRADIENTS.length],
          ring && "ring-2 ring-surface",
        )}
      >
        {showImage ? (
          <img
            src={src!}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      {online !== undefined && (
        <OnlineDot online={online} pulse={false} size={DOT_SIZES[size]} className="absolute right-0 bottom-0 translate-x-[8%] translate-y-[8%]" />
      )}
    </span>
  );
}
