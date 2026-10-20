"use client";

import { useState } from "react";
import { ShieldAlert, Ban, Check } from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/shared/report-reasons";

interface Target {
  id: string;
  displayName: string;
}

export function BlockDialog({
  open,
  onClose,
  user,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  user: Target;
  onBlocked?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} size="sm" title={`Block ${user.displayName}?`}>
      <div className="space-y-5">
        <ul className="space-y-2.5 text-sm text-ink-muted">
          {[
            "They won't be able to message you or see you in Nearby.",
            "You won't see each other's online status.",
            "They won't be told that you blocked them.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/api/users/${user.id}/block`);
                toast.success(`${user.displayName} is blocked`, "You can unblock them anytime in Settings.");
                onClose();
                onBlocked?.();
              } catch (e) {
                toast.error("Couldn't block", e instanceof Error ? e.message : undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Ban className="size-4" aria-hidden />
            Block
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ReportDialog({
  open,
  onClose,
  user,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  user: Target;
  onBlocked?: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) {
      setError("Choose a reason so we can review it properly.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/reports", { userId: user.id, reason, details: details.trim() || undefined, alsoBlock });
      toast.success("Thanks for letting us know", alsoBlock ? `We've received your report and blocked ${user.displayName}.` : "We've received your report.");
      onClose();
      setReason(null);
      setDetails("");
      if (alsoBlock) onBlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report ${user.displayName}`}
      description="Reports are confidential. Our team reviews every one."
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="sr-only">Reason</legend>
          <div className="grid gap-2" role="radiogroup">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
                  reason === r ? "border-primary bg-primary-soft text-primary-ink" : "border-border text-ink hover:border-border-strong hover:bg-surface-2",
                )}
              >
                {REPORT_REASON_LABELS[r]}
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border-2 transition",
                    reason === r ? "border-primary bg-primary" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {reason === r && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <Textarea
          label="Anything else we should know?"
          placeholder="Optional details"
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="min-h-24"
        />
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="size-4.5 accent-[var(--primary)]"
          />
          <span>
            <span className="font-semibold text-ink">Also block {user.displayName}</span>
            <span className="block text-ink-muted">They won&apos;t be able to contact you.</span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            <ShieldAlert className="size-4" aria-hidden />
            Send report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
