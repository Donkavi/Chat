# Langa

**Meet new people. Right around you.** Langa is a location-based social discovery and chat web app, built first for Sri Lanka. You turn on location, choose a radius, see who's online nearby, open their profile and start a private real-time conversation.

**Discover → View profile → Say hello 👋 → Chat in real time.**

---

## Quick start (local)

Requirements: Node.js 20.9+ (tested on 24). You don't need to install MongoDB or Docker.

```bash
npm install
cp .env.example .env.local     # then set AUTH_SECRET (see the comment in the file)

npm run db:local               # terminal 1: local MongoDB on 127.0.0.1:27017 (data in ./.mongo-data)
npm run seed                   # once: 24 fictional profiles around Colombo + a demo account
npm run dev                    # terminal 2: app + realtime server on http://localhost:3000
npm run simulate               # terminal 3 (optional): brings seed users online; they reply to chats
```

Sign in as **demo@langa.lk / langa-demo-123**. Allow location when Discover asks; the seed users are spread around Colombo, so 5–10 km works well from there. Every seed user also uses the password `langa-demo-123` (e.g. `amaya.f`), so you can open a second browser profile and chat between two real accounts.

> To use your own MongoDB (Atlas or local), set `MONGODB_URI` and skip `db:local`.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Custom server (`server.ts`): Next.js dev + Socket.IO on one port |
| `npm run build` / `npm start` | Production build / production server |
| `npm test` | Vitest suite against an in-memory MongoDB (auth, discovery, chat, realtime) |
| `npm run lint` / `npm run typecheck` | ESLint (Next + TypeScript rules) / `tsc --noEmit` |
| `npm run check` | typecheck + lint + tests |
| `npm run db:local` | Disk-backed MongoDB for development (via `mongodb-memory-server`) |
| `npm run seed` | Dev-only seed data (refuses non-local databases unless `ALLOW_SEED=true`) |
| `npm run simulate` | Dev-only: seed users connect over real sockets, stay online and reply |

---

## Architecture

```
server.ts                 One Node process: Next.js request handler + Socket.IO on the same HTTP server
src/
  app/                    App Router pages and API route handlers
    (auth)/               login, register, forgot/reset password
    (app)/                authenticated app: discover, chats, chats/[id], profile, settings
    api/                  REST endpoints (see below)
  components/             UI: ui/ (design system), discover/, chat/, people/, profile/, settings/, providers/
  lib/                    env, db, geo, validation (Zod, shared client/server), rate limiting, auth primitives
  server/
    models/               Mongoose models: User, Session, PasswordResetToken, Conversation, Message, Block, Report
    services/             Business logic: auth, discovery, conversations, messages, blocks, users
    realtime/             Socket.IO server, presence service and store, event hub
    http.ts               Route wrapper: auth, Origin check, validation, consistent error envelopes
  shared/                 DTO types, socket event contract, constants shared by browser and server
  proxy.ts                Optimistic redirect for signed-out visitors (the real checks happen server-side)
scripts/                  local Mongo, seed, simulator
tests/                    Vitest suites
```

**Stack:** Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS 4, MongoDB + Mongoose 9 (GeoJSON + `2dsphere`), Socket.IO 4, Zod 4, Motion, Lucide, Argon2id (`@node-rs/argon2`), sharp (image processing), Nodemailer.

### API

All responses are either `{ data }` or `{ error: { code, message, fields? } }`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/username?u=` |
| Profile | `GET/PATCH/DELETE /api/users/me`, `PATCH /api/users/me/privacy`, `POST/DELETE /api/users/me/avatar`, `GET /api/users/me/blocks`, `GET /api/users/:id` |
| Location & discovery | `PATCH /api/location` (share/refresh), `DELETE /api/location` (stop + erase), `GET /api/nearby?radiusKm=1\|5\|10\|25\|50\|100&cursor=` |
| Chat | `GET/POST /api/conversations`, `GET /api/conversations/:id`, `GET/POST /api/conversations/:id/messages?before=&after=`, `POST /api/conversations/:id/read` |
| Safety | `POST/DELETE /api/users/:id/block`, `POST /api/reports` |
| Ops | `GET /api/health`, `GET /api/uploads/*` (local avatar storage) |

### Realtime events (`src/shared/events.ts`)

Client → server: `message:send` (with ack), `typing:start`, `typing:stop`, `presence:heartbeat`, `presence:subscribe`.
Server → client: `message:new`, `conversation:updated`, `conversation:read`, `conversation:removed`, `typing:update`, `presence:update`, `session:revoked`.

- Sockets authenticate with the same HTTP-only session cookie as the API. Cross-origin handshakes are rejected.
- Each socket joins **only its own user room** (`user:<id>`). Clients can't join rooms, so private messages can't be broadcast to other users.
- The sender is always taken from the authenticated socket or session. Conversation membership and blocks are checked on every send and typing event.
- A message is persisted **before** the ack. The client renders it optimistically as "Sending" and marks it "Sent" only after the ack. If sending fails it shows "Not delivered" with Retry. Retries reuse the same `clientId`, and a unique index makes them idempotent.
- After a reconnect, the client refetches the conversation list and loads any missed messages (`?after=<lastId>`). If the socket is down, sending falls back to HTTP.

### Discovery and location privacy

- Locations are stored as GeoJSON `Point`s (`[longitude, latitude]`) **rounded to about 110 m**, with a `2dsphere` index. Nearby search is a single `$geoNear` aggregation. It never loads the whole user collection.
- Eligibility, all checked in the query: discoverable, sharing location, location updated in the last **30 minutes**, online with a heartbeat in the last **2 minutes**, not the viewer, not blocked in either direction.
- Responses go through a whitelist projection and DTO. Raw coordinates never appear in API responses, socket payloads, client state or logs. Distances are coarsened ("Under 1 km", nearest 0.5 km below 10 km, nearest 1 km above) to make trilateration harder. Location updates and nearby queries are rate-limited.
- Turning sharing off **deletes** the stored location. To discover others, you must share your own location.
- The browser permission prompt only appears after you tap a button, never on page load. The location refreshes every 5 minutes, only while the tab is visible and permission is already granted.
- Uploaded avatars are re-encoded with sharp, which strips EXIF metadata (including GPS tags).

### Presence

- `PresenceService` counts sockets per user, so several tabs or devices are handled and closing one tab doesn't mark you offline. It writes to the DB only when your first tab connects, about every 48 s of heartbeats, and once after your last tab has been gone for a 5 s grace period.
- Dead connections are caught by Socket.IO ping/pong (about 40 s) plus a sweeper that drops sockets without an app-level heartbeat for 60 s. Everyone treats `isOnline` as true only if `lastSeenAt` is fresh, so a crashed server can't leave "ghost" online users.
- Hiding your online status hides your dot and last-seen time everywhere, including live presence pushes. Presence is never sent between blocked users.

### Security measures

- Argon2id password hashing (OWASP parameters), with timing-equalised failures for unknown accounts.
- Opaque 256-bit session tokens in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production). Only an HMAC of the token is stored. Sessions expire after 30 days with rolling renewal. Password reset revokes all sessions.
- CSRF protection: SameSite cookies plus an Origin / `Sec-Fetch-Site` check on every state-changing API request, and an Origin allowlist on the socket handshake.
- Zod validation on every input. Errors return safe messages, and unknown errors become a generic 500 without leaking internals.
- NoSQL injection: inputs are validated as strings and numbers before any query is built, and `strictQuery` is on.
- Rate limits: login (per IP and per account), registration, password reset, nearby, location, messages, typing, reports, uploads.
- Uploads: 5 MB limit, file type checked by its magic bytes (not the claimed type), re-encoded, random UUID keys, path-traversal-safe serving.
- React escapes all user content, and response security headers are set in `next.config.ts`.
- Non-members get the same 404 as a missing conversation, so conversation IDs can't be probed.

---

## Configuration

See [`.env.example`](.env.example). The main variables:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `APP_URL` | Public origin. Used for email links and the Origin allowlist |
| `AUTH_SECRET` | 32+ random characters. **Required in production** |
| `STORAGE_DRIVER` | `local` (disk, `UPLOAD_DIR`) or `cloudinary` (`CLOUDINARY_*`) |
| `SMTP_*`, `EMAIL_FROM` | Password-reset emails. Without SMTP, dev prints the reset link to the server console |

---

## Deployment

Langa needs **a long-running Node process**, because Socket.IO keeps WebSocket connections open:

```bash
npm ci && npm run build
NODE_ENV=production npm start      # serves on $PORT
```

Good fits: a VM, a Docker container, Render, Railway, Fly.io, or Azure App Service with WebSockets enabled. Put it behind a reverse proxy that supports WebSocket upgrades and sets `X-Forwarded-For` (rate limiting uses it).

**Serverless platforms (e.g. Vercel functions) can't host the Socket.IO server.** To use one, deploy the Next.js app there and run `src/server/realtime/socket-server.ts` as a separate service on a WebSocket-capable host, sharing the same MongoDB, `AUTH_SECRET` and cookie domain. Then point the client at it (`io(<realtime url>)` in `realtime-provider.tsx`). For that setup, route handlers should publish their emits through a shared bus such as Redis pub/sub instead of the in-process `getIO()`.

### Scaling past one instance

The following are **in-process** and correct only for a single server:

- presence connection counts (`InMemoryPresenceStore`)
- rate-limit buckets (`src/lib/rate-limit.ts`)
- Socket.IO rooms

On startup the server marks every user offline, which also assumes a single instance. To run several instances: add `@socket.io/redis-adapter`, implement `PresenceStore` on Redis (the interface is already in place), move rate limiting to Redis, and replace the reset-on-boot step with TTL-based presence keys.

---

## Known limitations

- Moderation is report collection only: reports are stored with status `open`, but there is no admin review UI yet.
- Read receipts are per conversation ("Seen" under your latest message), not per message.
- Social login isn't implemented. The `authProviders` field and the session layer are ready for it.
- Distance coarsening and rate limits make precise location guessing much harder, but a determined attacker with many accounts could still narrow someone down to a neighbourhood. That is inherent to any "people near you" feature.
- Seed and landing imagery come from randomuser.me (placeholder photos of fictional people). If that host is unreachable, avatars fall back to initials.
