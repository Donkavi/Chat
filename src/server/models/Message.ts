import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface MessageDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  /** Client-generated id; makes retries idempotent and lets the UI reconcile optimistic messages. */
  clientId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 2000 },
    clientId: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true },
);

// Cursor pagination: newest-first within a conversation.
MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index(
  { senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

export const Message: Model<MessageDoc> =
  (mongoose.models.Message as Model<MessageDoc> | undefined) ?? mongoose.model<MessageDoc>("Message", MessageSchema);
