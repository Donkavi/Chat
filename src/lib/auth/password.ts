import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default) with the OWASP baseline: 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Burn roughly the same time as a real verification when the account doesn't
 * exist, so response timing doesn't reveal which emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("lumos-dummy-password-for-timing");
  await verifyPassword(await dummyHash, password);
  return false;
}
