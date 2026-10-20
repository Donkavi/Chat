import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ConversationMember {
  userId: Types.ObjectId;
  unreadCount: number;
  lastReadAt: Date | null;
}

export interface LastMessageSnapshot {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  createdAt: Date;
}

export interface ConversationDoc {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  /** Sorted participant ids joined with ":" — guarantees one conversation per pair. */
  participantsKey: string;
  members: ConversationMember[];
  createdBy: Types.ObjectId;
  lastMessage: LastMessageSnapshot | null;
  lastMessageAt: Date | null;
  /** lastMessageAt, or createdAt for a conversation with no messages yet. Drives list ordering. */
  activityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LastMessageSchema = new Schema<LastMessageSnapshot>(
  {
    messageId: { type: Schema.Types.ObjectId, required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const ConversationSchema = new Schema<ConversationDoc>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: { validator: (p: unknown[]) => p.length === 2, message: "A private conversation has exactly two participants." },
    },
    participantsKey: { type: String, required: true },
    members: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          unreadCount: { type: Number, default: 0, min: 0 },
          lastReadAt: { type: Date, default: null },
          _id: false,
        },
      ],
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessage: { type: LastMessageSchema, default: null },
    lastMessageAt: { type: Date, default: null },
    activityAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

ConversationSchema.index({ participantsKey: 1 }, { unique: true });
ConversationSchema.index({ participants: 1, activityAt: -1 });

export function participantsKeyFor(a: Types.ObjectId | string, b: Types.ObjectId | string): string {
  return [String(a), String(b)].sort().join(":");
}

export const Conversation: Model<ConversationDoc> =
  (mongoose.models.Conversation as Model<ConversationDoc> | undefined) ??
  mongoose.model<ConversationDoc>("Conversation", ConversationSchema);
