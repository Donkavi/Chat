import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface BlockDoc {
  _id: Types.ObjectId;
  blockerId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  createdAt: Date;
}

const BlockSchema = new Schema<BlockDoc>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });
BlockSchema.index({ blockedUserId: 1 });

export const Block: Model<BlockDoc> =
  (mongoose.models.Block as Model<BlockDoc> | undefined) ?? mongoose.model<BlockDoc>("Block", BlockSchema);
