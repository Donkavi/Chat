import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface PasswordResetTokenDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<PasswordResetTokenDoc>(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PasswordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetTokenSchema.index({ userId: 1 });
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken: Model<PasswordResetTokenDoc> =
  (mongoose.models.PasswordResetToken as Model<PasswordResetTokenDoc> | undefined) ??
  mongoose.model<PasswordResetTokenDoc>("PasswordResetToken", PasswordResetTokenSchema);
