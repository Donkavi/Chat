export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "fake_profile", "underage", "safety", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or scam",
  harassment: "Harassment or bullying",
  inappropriate: "Inappropriate content",
  fake_profile: "Fake profile or impersonation",
  underage: "May be under 18",
  safety: "I feel unsafe",
  other: "Something else",
};
