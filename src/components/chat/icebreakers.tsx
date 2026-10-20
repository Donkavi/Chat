"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { PublicUser } from "@/shared/types";

function suggestionsFor(other: PublicUser, shared: string[]) {
  const first = other.displayName.split(" ")[0];
  const list = [`Hey ${first}! 👋`];
  if (shared[0]) list.push(`I see you're into ${shared[0].toLowerCase()} too — how did you get into it?`);
  else if (other.interests[0]) list.push(`${other.interests[0]} sounds fun — how did you get into it?`);
  list.push("What's your favourite spot around here?");
  list.push("Hi! How's your day going? 😊");
  return list.slice(0, 4);
}

/** First-message helper: a friendly nudge plus tap-to-use openers (they fill the composer, never auto-send). */
export function Icebreakers({ other, myInterests, onPick }: { other: PublicUser; myInterests: string[]; onPick: (text: string) => void }) {
  const mine = new Set(myInterests.map((i) => i.toLowerCase()));
  const shared = other.interests.filter((i) => mine.has(i.toLowerCase()));
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center"
    >
      <div className="relative">
        <span className="absolute -inset-3 rounded-full bg-[var(--glow-1)] blur-xl" aria-hidden />
        <Avatar name={other.displayName} src={other.avatarUrl} seed={other.id} size="2xl" className="relative" ring />
      </div>
      <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">Say hello to {other.displayName.split(" ")[0]} 👋</h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">
        {shared.length > 0 ? (
          <>
            You both like <strong className="font-semibold text-primary-ink">{shared.slice(0, 2).join(" & ")}</strong>. That&apos;s a great place to start.
          </>
        ) : (
          "A friendly first message goes a long way. Need a nudge?"
        )}
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {suggestionsFor(other, shared).map((s, i) => (
          <motion.button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
          >
            <Sparkles className="size-4 shrink-0 text-primary opacity-70 transition group-hover:opacity-100" aria-hidden />
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
