import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface SessionDoc {
  _id: Types.ObjectId;
  /** HMAC-SHA256 of the opaque cookie token. The raw token is never stored. */
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  lastUsedAt: Date;
  userAgent: string | null;
  createdAt: Date;
}

const SessionSchema = new Schema<SessionDoc>(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    userAgent: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SessionSchema.index({ tokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1 });
// MongoDB removes expired sessions automatically.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc> | undefined) ??
  mongoose.model<SessionDoc>("Session", SessionSchema);
