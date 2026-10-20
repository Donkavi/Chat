import { z } from "zod";
import { REPORT_REASONS } from "@/shared/report-reasons";
import { BIO_MAX_LENGTH, MAX_INTERESTS, MESSAGE_MAX_LENGTH } from "@/shared/constants";
import { ANY_RADIUS_KM, RADIUS_OPTIONS_KM } from "./geo";

/** Schemas shared by forms (client) and route handlers (server). The server is always authoritative. */

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, { error: "Invalid id." });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: "Username must be at least 3 characters." })
  .max(24, { error: "Username must be at most 24 characters." })
  .regex(/^[a-z0-9_.]+$/, { error: "Use letters, numbers, dots and underscores only." })
  .refine((u) => !u.startsWith(".") && !u.endsWith(".") && !u.includes(".."), {
    error: "Dots can't be at the start, end, or next to each other.",
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Tell people what to call you." })
  .max(40, { error: "Keep it under 40 characters." });

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address." }));

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(128, { error: "That password is too long." });

export const registerSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmAdult: z.literal(true, { error: "You must be 18 or older to use Langa." }),
});

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, { error: "Enter your email or username." }).max(254),
  password: z.string().min(1, { error: "Enter your password." }).max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const interestsSchema = z
  .array(z.string().trim().min(2, { error: "Interests need at least 2 characters." }).max(24))
  .max(MAX_INTERESTS, { error: `Pick up to ${MAX_INTERESTS} interests.` })
  .transform((list) => {
    const seen = new Set<string>();
    return list.filter((i) => {
      const k = i.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema,
    username: usernameSchema,
    bio: z.string().trim().max(BIO_MAX_LENGTH, { error: `Keep your bio under ${BIO_MAX_LENGTH} characters.` }),
    interests: interestsSchema,
    age: z
      .number()
      .int()
      .min(18, { error: "You must be 18 or older." })
      .max(120, { error: "Enter a real age." })
      .nullable(),
  })
  .partial();

export const privacyUpdateSchema = z
  .object({
    isDiscoverable: z.boolean(),
    showOnlineStatus: z.boolean(),
    showAge: z.boolean(),
  })
  .partial();

export const locationUpdateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative().max(100_000).optional(),
});

export const radiusSchema = z.coerce
  .number()
  .refine((n): n is (typeof RADIUS_OPTIONS_KM)[number] => (RADIUS_OPTIONS_KM as readonly number[]).includes(n), {
    error: `Radius must be one of ${RADIUS_OPTIONS_KM.join(", ")} km (${ANY_RADIUS_KM} means any distance).`,
  });

export const nearbyQuerySchema = z.object({
  radiusKm: radiusSchema.default(10),
  cursor: z
    .string()
    .regex(/^\d{1,4}$/)
    .optional(),
});

export const createConversationSchema = z.object({ userId: objectId });

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, { error: "Message can't be empty." })
  .max(MESSAGE_MAX_LENGTH, { error: `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.` });

export const clientIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, { error: "Invalid client id." });

export const sendMessageSchema = z.object({
  conversationId: objectId,
  content: messageContentSchema,
  clientId: clientIdSchema,
});

export const messagesQuerySchema = z.object({
  before: objectId.optional(),
  after: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const reportSchema = z.object({
  userId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  alsoBlock: z.boolean().default(false),
});

export const deleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.literal("DELETE", { error: 'Type "DELETE" to confirm.' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PrivacyUpdateInput = z.infer<typeof privacyUpdateSchema>;
