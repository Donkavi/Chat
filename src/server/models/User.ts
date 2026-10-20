import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { GeoPoint } from "@/lib/geo";

export interface PrivacySettings {
  /** Whether others can see the green "online" dot and "active Xm ago". */
  showOnlineStatus: boolean;
  /** Whether the optional age is shown on the public profile. */
  showAge: boolean;
}

export interface AuthProvider {
  provider: string; // e.g. "google" — reserved for future social login
  providerId: string;
}

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  authProviders: AuthProvider[];
  avatarUrl: string | null;
  avatarKey: string | null;
  bio: string;
  interests: string[];
  age: number | null;
  /** GeoJSON point, [lng, lat], rounded to ~110 m. Unset when sharing is off. */
  location?: GeoPoint;
  locationUpdatedAt: Date | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  isDiscoverable: boolean;
  isLocationSharingEnabled: boolean;
  privacySettings: PrivacySettings;
  /** Marks development seed data so the seed script never touches real accounts. */
  isSeed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (c: number[]) =>
          c.length === 2 && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
        message: "Coordinates must be [longitude, latitude] within valid ranges.",
      },
    },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    username: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 24 },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    passwordHash: { type: String, default: null },
    authProviders: {
      type: [{ provider: String, providerId: String, _id: false }],
      default: [],
    },
    avatarUrl: { type: String, default: null },
    avatarKey: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 280 },
    interests: { type: [String], default: [] },
    age: { type: Number, default: null, min: 18, max: 120 },
    location: { type: PointSchema, default: undefined },
    locationUpdatedAt: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    isDiscoverable: { type: Boolean, default: true },
    isLocationSharingEnabled: { type: Boolean, default: false },
    privacySettings: {
      showOnlineStatus: { type: Boolean, default: true },
      showAge: { type: Boolean, default: true },
    },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ location: "2dsphere" });
UserSchema.index({ "authProviders.provider": 1, "authProviders.providerId": 1 }, { sparse: true });

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ?? mongoose.model<UserDoc>("User", UserSchema);
