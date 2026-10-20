# Langa: implementation notes

A handover for picking this project up on another machine: how to move it, how to get it running, how it's built, and the non-obvious decisions to keep. For product-level docs (features, API list, deployment) see [README.md](README.md).

Snapshot as of 2026-10-20: typecheck, lint, 47/47 tests and `next build` all pass.

---

## 1. Moving the project

### What to copy

Copy the source only. Everything below is either regenerated or machine-specific.

| Don't copy | Why |
| --- | --- |
| `node_modules/` | Reinstall with `npm ci` (native modules `@node-rs/argon2` and `sharp` are per-platform) |
| `.next/`, `tsconfig.tsbuildinfo`, `next-env.d.ts` | Build output, regenerated |
| `.mongo-data/` | Local dev database. Copying it is optional; `npm run seed` recreates the demo data |
| `uploads/` | Locally uploaded avatars (dev only) |
| `.env.local` | Contains this machine's `AUTH_SECRET`. Create a fresh one on the new machine |

Keep `package-lock.json`, so the new machine installs the same versions.

### Option A: git (recommended)

The folder is already a git repository with nothing committed yet, and `.gitignore` already excludes everything in the table above.

```bash
git add -A
git commit -m "Initial Langa implementation"
git remote add origin <your-repo-url>
git push -u origin main
# on the new machine
git clone <your-repo-url> langa && cd langa
```

### Option B: zip

Zip the folder without the paths listed in the table, then unzip on the new machine.

---

## 2. Setting up the new machine

### Prerequisites

- **Node.js 20.9+** (developed on 24.14). Nothing else is required: MongoDB comes from `mongodb-memory-server` and no Docker is needed.
- The first `npm run db:local` and the first `npm test` download a MongoDB binary (about 75 MB, cached in `node_modules/.cache`) from `fastdl.mongodb.org`, so that host must be reachable.

### Steps

```bash
npm ci
cp .env.example .env.local
# Generate a secret and paste it into AUTH_SECRET in .env.local:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm run db:local      # terminal 1: MongoDB on 127.0.0.1:27017
npm run seed          # once
npm run dev           # terminal 2: http://localhost:3000
npm run simulate      # terminal 3, optional: seed users come online and reply
```

Sign in as `demo@langa.lk` / `langa-demo-123`.

To use a real MongoDB instead (Atlas or a local install), set `MONGODB_URI` in `.env.local` and skip `db:local`. The seed script refuses any non-local URI unless `ALLOW_SEED=true` is set.

### npm registry note

On the original machine the global `.npmrc` pointed at the company mirror `npm.codegen.net`, which timed out off-VPN. Everything was installed from the public registry instead:

```bash
npm ci --registry https://registry.npmjs.org
```

Use that flag if the new machine has the same mirror configured and it isn't reachable.

### Check that everything works

```bash
npm run check         # typecheck + lint + tests
npm run build         # production build
```

---

## 3. What's built

| Area | Status |
| --- | --- |
| Email/password auth: register, login, logout, password reset, sessions | Done |
| Profiles: photo upload, name, username, bio, interests, optional age | Done |
| Browser geolocation with explainer, denied and unsupported states, pause/stop sharing | Done |
| Nearby discovery: 1/5/10/25/50/100 km, online only, distance-sorted, paginated | Done |
| Realtime presence across multiple tabs and devices, with heartbeats | Done |
| Private realtime chat: optimistic sending with retry, typing, unread counts, read receipts, history pagination, reconnect catch-up | Done |
| Block, report, privacy toggles, account deletion | Done |
| Light and dark themes, responsive desktop and mobile layouts | Done |
| Dev tooling: local DB, seed, simulator | Done |
| Admin UI for reviewing reports | **Not built** (reports are stored with status `open`) |
| Social login | **Not built** (`User.authProviders` field reserved) |
| Multi-instance scaling with Redis | **Not built** (interfaces ready; see section 6) |

---

## 4. How it's put together

### Runtime

`server.ts` is a **custom Node server**. It creates one HTTP server and runs the Next.js request handler and Socket.IO on it. It is started with `tsx` in both dev (`tsx watch`) and production (`npm start`).

Boot order matters:

1. `@next/env` loads `.env*` files.
2. Only then are app modules imported, with dynamic `await import()`.
3. The DB connects and all users are marked offline (the single-instance assumption).
4. Next prepares, then the socket server attaches.

### Code layout

| Path | Contents |
| --- | --- |
| `src/app/` | Pages (route groups `(auth)` and `(app)`) and API route handlers |
| `src/server/models/` | Mongoose models |
| `src/server/services/` | All business rules. Routes and socket handlers are thin wrappers around these |
| `src/server/realtime/` | `socket-server.ts` (handlers), `presence.ts` (`PresenceStore` + `PresenceService`), `hub.ts` (global `io` handle + `emitToUser`), `presence-notify.ts` |
| `src/server/http.ts` | `route()` / `authed()` wrappers: Origin check, DB connect, session lookup, Zod errors to 422, `{data}` / `{error}` envelopes |
| `src/lib/` | `env`, `db`, `geo`, `validation` (Zod, shared with the client), `rate-limit`, `auth/*`, `format`, `client/api.ts` |
| `src/shared/` | DTO types, the socket event contract, constants used by both client and server |
| `src/components/` | `ui/` (design system), `providers/` (session, realtime, presence, chat, location), and feature folders |
| `src/proxy.ts` | Next 16's replacement for middleware: a cookie-presence redirect only |

### Data model

| Collection | Notes |
| --- | --- |
| **User** | `location` is a GeoJSON Point `[lng, lat]` rounded to 3 decimals, with a `2dsphere` index. It's **unset** (not null) when sharing is off. Also: `isOnline` + `lastSeenAt`, `isDiscoverable`, `isLocationSharingEnabled`, `privacySettings.{showOnlineStatus, showAge}`, `isSeed` |
| **Session** | `tokenHash` is the HMAC-SHA256 of the cookie token under `AUTH_SECRET`. TTL index on `expiresAt` |
| **PasswordResetToken** | Hashed, single use, 1-hour TTL |
| **Conversation** | `participantsKey` (sorted ids, unique) prevents duplicates. `members[]` holds per-user `unreadCount` and `lastReadAt`. Also a `lastMessage` snapshot, and `activityAt` for sorting |
| **Message** | Index `{conversationId, _id: -1}` for cursor pagination. Unique `{senderId, clientId}` makes retries idempotent |
| **Block** | Unique `{blockerId, blockedUserId}`. Checked in both directions everywhere |
| **Report** | Repeat reports from the same person within 24 h collapse into one |

### Request flows

**Discovery.** `GET /api/nearby` runs one `$geoNear` aggregation. Its `query` filters out:
- the viewer, and blocked users in both directions
- users who aren't discoverable or aren't sharing
- locations older than 30 minutes
- users whose `lastSeenAt` is older than 2 minutes

The result goes through a whitelist `$project`, then `toPublicUser`, then `approximateDistanceKm`.

**Sending a message.**
1. The client sends `message:send` over the socket, with an ack and a 10 s timeout. If the socket is disconnected it falls back to `POST /api/conversations/:id/messages`.
2. `services/messages.sendMessage` checks the rate limit, membership and blocks, then handles the idempotent `clientId`.
3. It inserts the message and updates the conversation with array filters: increments the recipient's unread count and resets the sender's read state.
4. It emits `message:new` to `user:<id>` rooms only, then returns the result for the ack.

**Presence.** The client sends a heartbeat every 25 s. The server writes `lastSeenAt` at most every 48 s per user, sweeps sockets that have been idle for 60 s, and waits 5 s after the last tab closes before marking someone offline. Clients `presence:subscribe` to the user ids currently on screen, and updates are pushed to `presence:<id>` rooms.

**Read receipts.** The open thread calls `POST /conversations/:id/read`, which emits `conversation:read` to both users. The thread shows "Seen" when `otherLastReadAt` is at or after your message's time.

---

## 5. Non-obvious decisions (don't undo these by accident)

1. **TypeScript 6.x, not 7.** TS 7 is the native Go port, while Next.js and typescript-eslint use the JS compiler API. **ESLint 9**, not 10, for plugin compatibility.
2. **`destroyUpgrade: false`** on Socket.IO. Without it, Socket.IO kills Next's HMR WebSocket upgrades on the shared server.
3. **Models are registered as `mongoose.models.X ?? mongoose.model(...)`.** The same files load through both tsx (the server) and Next's bundler (routes). Mongoose is listed in `serverExternalPackages`, so both share one instance.
4. **Cross-bundle singletons live on `globalThis`**: `__langaIO` (the socket server, used by routes to emit) and `__langaRateLimit`. `db.ts` tracks connection state on the mongoose instance itself rather than in a module variable.
5. **The ESLint rule `react-hooks/set-state-in-effect` is enforced.**
   - Browser-stored values (theme, radius) use `useSyncExternalStore`.
   - Fetch helpers called from effects use `.then()` chains, not `async` with try/catch (the rule misreads those).
   - Only two deliberate exceptions exist, each with a comment: socket creation, and a measurement in the chat layout effect.
6. **`next.config.ts` pins `turbopack.root` and `outputFileTracingRoot`** to `process.cwd()`. A stray `package-lock.json` in the user's home folder was confusing Next's root detection.
7. **`/*turbopackIgnore: true*/` in `server/storage.ts`.** `UPLOAD_DIR` is configured at runtime, so the build mustn't trace the whole project because of it.
8. **The Origin check sits in the route wrapper, not the proxy.** That way it's covered by tests and applies to every mutating API route.
9. **The location permission prompt only fires from a button.** Background refresh runs only when permission is already `granted`, sharing is on, and the tab is visible.
10. **Avatars are re-encoded with sharp.** This strips EXIF (which can contain GPS coordinates) and neutralises polyglot files.

---

## 6. Limits and next steps

- **Single instance only**, for now. Presence counts, rate limits and socket rooms are in-process, and boot resets everyone to offline. To scale out:
  - add `@socket.io/redis-adapter`
  - implement `PresenceStore` on Redis
  - move `rate-limit.ts` onto Redis
  - replace `PresenceService.resetAll()` with TTL keys
- **Serverless hosting** (e.g. Vercel) can't run `server.ts`. You would run the socket server as a separate service and route emits through a Redis pub/sub bus. Details are in the README.
- **Moderation:** build an admin review flow for `Report` (statuses `open` → `reviewing` → `resolved` / `dismissed`).
- **Email:** without SMTP settings, reset links only print to the server console in development, and production sends nothing.
- **Demo photos:** seed and landing images come from randomuser.me. Avatars fall back to initials if it's unreachable.

---

## 7. Tests

`tests/` uses Vitest with a single `mongodb-memory-server` started in `global-setup.ts`. Each test file gets its own database, and collections are wiped before each test.

| File | Covers |
| --- | --- |
| `geo.test.ts` | `[lng, lat]` ordering, rounding, haversine distances, distance coarsening |
| `auth.test.ts` | Registration, Argon2id hashing, cookie flags, login rate limiting, CSRF Origin block, password reset, profile and privacy updates, account deletion |
| `discovery.test.ts` | Radius filtering, sorting, self and block exclusion, privacy, presence and location staleness, pagination, no coordinate leaks |
| `chat.test.ts` | Conversation dedupe (including concurrent creation), membership authorisation, sender taken from the session, idempotent sends, unread counts and read receipts, pagination and catch-up, blocks, reports |
| `realtime.test.ts` | Real Socket.IO clients: auth and Origin rejection, multi-tab presence, delivery to participants only, typing indicators, presence privacy |
