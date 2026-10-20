import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { GET as getMe, PATCH as patchMe, DELETE as deleteMe } from "@/app/api/users/me/route";
import { PATCH as patchPrivacy } from "@/app/api/users/me/privacy/route";
import { User } from "@/server/models/User";
import { Session } from "@/server/models/Session";
import { PasswordResetToken } from "@/server/models/PasswordResetToken";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { body, cookieFor, makeUser, noParams, req } from "./helpers";

const valid = { displayName: "Nimal Perera", username: "nimal", email: "Nimal@Example.com", password: "correct horse", confirmAdult: true };

function sessionCookieFrom(res: Response) {
  const set = res.headers.get("set-cookie") ?? "";
  return { raw: set, pair: set.split(";")[0] };
}

describe("registration", () => {
  it("creates an account, hashes the password with Argon2id and starts a session", async () => {
    const res = await register(req("POST", "/api/auth/register", { body: valid }), noParams);
    expect(res.status).toBe(201);
    const { data } = await body<{ data: Record<string, unknown> }>(res);
    expect(data.email).toBe("nimal@example.com");
    expect(data).not.toHaveProperty("passwordHash");

    const cookie = sessionCookieFrom(res);
    expect(cookie.raw).toMatch(/langa_session=/);
    expect(cookie.raw).toMatch(/HttpOnly/i);
    expect(cookie.raw).toMatch(/SameSite=lax/i);

    const stored = await User.findOne({ username: "nimal" }).lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain("correct horse");
    // Session tokens are stored hashed, never raw.
    const token = cookie.pair.split("=")[1];
    expect(await Session.exists({ tokenHash: token })).toBeNull();
  });

  it("rejects duplicate emails and usernames with field errors", async () => {
    await register(req("POST", "/api/auth/register", { body: valid }), noParams);
    const res = await register(req("POST", "/api/auth/register", { body: { ...valid, email: "nimal@example.com" } }), noParams);
    expect(res.status).toBe(409);
    const { error } = await body<{ error: { fields: Record<string, string> } }>(res);
    expect(error.fields.email).toBeTruthy();
    expect(error.fields.username).toBeTruthy();
  });

  it("validates input on the server", async () => {
    const res = await register(
      req("POST", "/api/auth/register", { body: { ...valid, username: "a", password: "short", email: "nope", confirmAdult: false } }),
      noParams,
    );
    expect(res.status).toBe(422);
    const { error } = await body<{ error: { fields: Record<string, string> } }>(res);
    expect(Object.keys(error.fields)).toEqual(expect.arrayContaining(["username", "password", "email", "confirmAdult"]));
  });

  it("rejects operator-injection payloads", async () => {
    const res = await login(req("POST", "/api/auth/login", { body: { identifier: { $ne: null }, password: "x" } }), noParams);
    expect(res.status).toBe(422);
  });
});

describe("login & sessions", () => {
  it("signs in with email or username and rejects wrong passwords generically", async () => {
    await register(req("POST", "/api/auth/register", { body: valid }), noParams);
    const ok = await login(req("POST", "/api/auth/login", { body: { identifier: "NIMAL", password: valid.password } }), noParams);
    expect(ok.status).toBe(200);

    const bad = await login(req("POST", "/api/auth/login", { body: { identifier: "nimal@example.com", password: "wrong pass" } }), noParams);
    const missing = await login(req("POST", "/api/auth/login", { body: { identifier: "ghost@example.com", password: "wrong pass" } }), noParams);
    expect(bad.status).toBe(401);
    expect(missing.status).toBe(401);
    expect((await body<{ error: { message: string } }>(bad)).error.message).toBe((await body<{ error: { message: string } }>(missing)).error.message);
  });

  it("rate-limits repeated failed logins for one account", async () => {
    await register(req("POST", "/api/auth/register", { body: valid }), noParams);
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await login(req("POST", "/api/auth/login", { body: { identifier: "nimal", password: `nope-${i}xx` } }), noParams);
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 6).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("protects /api/users/me and ends the session on logout", async () => {
    expect((await getMe(req("GET", "/api/users/me"), noParams)).status).toBe(401);
    const user = await makeUser();
    const cookie = await cookieFor(user);
    const me = await getMe(req("GET", "/api/users/me", { cookie }), noParams);
    expect(me.status).toBe(200);
    expect(await body(me)).toMatchObject({ data: { id: String(user._id) } });

    await logout(req("POST", "/api/auth/logout", { cookie }), noParams);
    expect((await getMe(req("GET", "/api/users/me", { cookie }), noParams)).status).toBe(401);
  });

  it("blocks cross-site state-changing requests", async () => {
    const user = await makeUser();
    const cookie = await cookieFor(user);
    const res = await patchMe(
      req("PATCH", "/api/users/me", { cookie, body: { bio: "pwned" }, headers: { origin: "https://evil.example" } }),
      noParams,
    );
    expect(res.status).toBe(403);
  });
});

describe("password reset", () => {
  it("resets the password with a valid single-use token and revokes sessions", async () => {
    const user = await makeUser();
    const cookie = await cookieFor(user);
    const token = generateToken();
    await PasswordResetToken.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) });

    const res = await resetPasswordRoute(req("POST", "/api/auth/reset-password", { body: { token, password: "brand new password" } }), noParams);
    expect(res.status).toBe(200);
    expect((await getMe(req("GET", "/api/users/me", { cookie }), noParams)).status).toBe(401);

    const ok = await login(req("POST", "/api/auth/login", { body: { identifier: user.username, password: "brand new password" } }), noParams);
    expect(ok.status).toBe(200);

    const reuse = await resetPasswordRoute(req("POST", "/api/auth/reset-password", { body: { token, password: "another password" } }), noParams);
    expect(reuse.status).toBe(400);
  });

  it("rejects expired tokens", async () => {
    const user = await makeUser();
    const token = generateToken();
    await PasswordResetToken.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 1000) });
    const res = await resetPasswordRoute(req("POST", "/api/auth/reset-password", { body: { token, password: "brand new password" } }), noParams);
    expect(res.status).toBe(400);
  });
});

describe("profile", () => {
  it("updates profile fields and normalises interests", async () => {
    const user = await makeUser();
    const cookie = await cookieFor(user);
    const res = await patchMe(
      req("PATCH", "/api/users/me", { cookie, body: { displayName: "Ama", bio: "Hello!", interests: ["Surfing", "surfing", "Coffee"], age: 25 } }),
      noParams,
    );
    expect(res.status).toBe(200);
    const { data } = await body<{ data: { displayName: string; interests: string[]; age: number } }>(res);
    expect(data.displayName).toBe("Ama");
    expect(data.interests).toEqual(["Surfing", "Coffee"]);
    expect(data.age).toBe(25);
  });

  it("refuses a taken username and under-18 ages", async () => {
    await makeUser({ username: "taken" });
    const user = await makeUser();
    const cookie = await cookieFor(user);
    expect((await patchMe(req("PATCH", "/api/users/me", { cookie, body: { username: "taken" } }), noParams)).status).toBe(409);
    expect((await patchMe(req("PATCH", "/api/users/me", { cookie, body: { age: 16 } }), noParams)).status).toBe(422);
  });

  it("updates privacy settings", async () => {
    const user = await makeUser();
    const cookie = await cookieFor(user);
    const res = await patchPrivacy(req("PATCH", "/api/users/me/privacy", { cookie, body: { isDiscoverable: false, showOnlineStatus: false } }), noParams);
    const { data } = await body<{ data: { isDiscoverable: boolean; privacySettings: { showOnlineStatus: boolean } } }>(res);
    expect(data.isDiscoverable).toBe(false);
    expect(data.privacySettings.showOnlineStatus).toBe(false);
  });

  it("deletes the account only with confirmation", async () => {
    await register(req("POST", "/api/auth/register", { body: valid }), noParams);
    const loginRes = await login(req("POST", "/api/auth/login", { body: { identifier: "nimal", password: valid.password } }), noParams);
    const cookie = sessionCookieFrom(loginRes).pair;
    expect((await deleteMe(req("DELETE", "/api/users/me", { cookie, body: { password: "wrong one", confirm: "DELETE" } }), noParams)).status).toBe(422);
    expect((await deleteMe(req("DELETE", "/api/users/me", { cookie, body: { password: valid.password, confirm: "nope" } }), noParams)).status).toBe(422);
    const ok = await deleteMe(req("DELETE", "/api/users/me", { cookie, body: { password: valid.password, confirm: "DELETE" } }), noParams);
    expect(ok.status).toBe(200);
    expect(await User.exists({ username: "nimal" })).toBeNull();
    expect(await Session.countDocuments({})).toBe(0);
  });
});
