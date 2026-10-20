import mongoose, { Schema, type Model, type Types } from "mongoose";
import { REPORT_REASONS, type ReportReason } from "@/shared/report-reasons";

export const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportDoc {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<ReportDoc>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: null, maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUSES, default: "open" },
  },
  { timestamps: true },
);

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reportedUserId: 1, createdAt: -1 });
ReportSchema.index({ reporterId: 1, reportedUserId: 1, createdAt: -1 });

export const Report: Model<ReportDoc> =
  (mongoose.models.Report as Model<ReportDoc> | undefined) ?? mongoose.model<ReportDoc>("Report", ReportSchema);
