"use client";

import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

/** Fictional demo people for marketing visuals only. */
const ORBIT = [
  { name: "Nethmi", photo: "https://randomuser.me/api/portraits/women/44.jpg", km: "0.8 km", x: "18%", y: "22%", delay: 0 },
  { name: "Kasun", photo: "https://randomuser.me/api/portraits/men/32.jpg", km: "2.5 km", x: "80%", y: "16%", delay: 0.8 },
  { name: "Dilini", photo: "https://randomuser.me/api/portraits/women/68.jpg", km: "4 km", x: "88%", y: "58%", delay: 1.6 },
  { name: "Ravindu", photo: "https://randomuser.me/api/portraits/men/75.jpg", km: "1.5 km", x: "10%", y: "64%", delay: 2.2 },
  { name: "Sahan", photo: "https://randomuser.me/api/portraits/men/46.jpg", km: "7 km", x: "56%", y: "90%", delay: 1.1 },
];

export function HeroVisual({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[34rem]", className)} aria-hidden>
      {/* Radar rings */}
      <div className="absolute inset-[6%] rounded-full border border-primary/15 bg-[radial-gradient(circle,var(--glow-1),transparent_70%)]" />
      <div className="absolute inset-[20%] rounded-full border border-primary/20" />
      <div className="absolute inset-[34%] rounded-full border border-primary/25" />
      <div className="absolute inset-[6%] rounded-full border-2 border-primary/30 animate-radar" />
      <div className="absolute inset-[6%] rounded-full border-2 border-primary/20 animate-radar [animation-delay:1.8s]" />

      {/* You */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="relative grid size-16 place-items-center rounded-full bg-sunset shadow-[0_14px_40px_-10px_rgb(240_83_44/0.8)]">
          <span className="size-4 rounded-full bg-white" />
        </span>
        <span className="absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-[0.6875rem] font-bold text-bg">You</span>
      </div>

      {/* People nearby */}
      {ORBIT.map((p, i) => (
        <motion.div
          key={p.name}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: p.x, top: p.y }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 + i * 0.12, type: "spring", stiffness: 260, damping: 20 }}
        >
          <div className="flex flex-col items-center animate-float" style={{ animationDelay: `${p.delay}s` }}>
            <Avatar name={p.name} src={p.photo} size={i % 2 ? "lg" : "xl"} online ring className="drop-shadow-xl" />
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink shadow-soft backdrop-blur">
              <MapPin className="size-3 text-primary" />
              {p.km}
            </span>
          </div>
        </motion.div>
      ))}

      {!compact && (
        <>
          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -8 }}
            animate={{ opacity: 1, y: 0, rotate: -5 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 140, damping: 18 }}
            className="absolute bottom-[4%] -left-[4%] hidden w-[42%] overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-lift sm:block"
          >
            <div className="relative aspect-[4/4.2]">
              <img src="https://randomuser.me/api/portraits/women/65.jpg" alt="" className="size-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[0.625rem] font-semibold text-white backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-online" /> Online
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="font-display text-base font-semibold text-white">Amaya, 26</p>
                <p className="text-[0.6875rem] text-white/85">1 km away</p>
              </div>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex gap-1">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-medium text-ink-muted">Surfing</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.625rem] font-medium text-primary-ink">Coffee</span>
              </div>
              <div className="flex h-8 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-white">Say hello 👋</div>
            </div>
          </motion.div>

          {/* Chat bubble */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.1, type: "spring", stiffness: 200, damping: 18 }}
            className="absolute top-[30%] -right-[3%] hidden w-[46%] space-y-2 sm:block"
          >
            <div className="ml-auto w-fit max-w-full rounded-[1.1rem] rounded-br-md bg-bubble-out px-3.5 py-2 text-[0.8125rem] leading-snug text-white shadow-lift">
              Hey! You&apos;re into photography too? 📷
            </div>
            <div className="w-fit max-w-full rounded-[1.1rem] rounded-bl-md border border-border bg-surface px-3.5 py-2 text-[0.8125rem] leading-snug text-ink shadow-lift">
              Yes! Galle Face at sunset is my favourite 🌅
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
