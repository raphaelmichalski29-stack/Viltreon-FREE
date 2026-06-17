import type { Adapter, AdapterAccount } from "next-auth/adapters"
import { encrypt, decrypt } from "./encryption"

export function secureAdapter(adapter: Adapter): Adapter {
  const wrapped: Adapter = { ...adapter }

  if (adapter.linkAccount) {
    // `@auth/prisma-adapter` types its linkAccount against `@auth/core/adapters`
    // (newer auth.js), but we're projecting it into next-auth v4's `Adapter`.
    // The two AdapterAccount shapes differ (v5 has "webauthn", token_type is
    // Lowercase<string>) but are structurally compatible at runtime.
    const inner = adapter.linkAccount as (data: AdapterAccount) => unknown
    wrapped.linkAccount = async (data: AdapterAccount) => {
      await inner({
        ...data,
        access_token: data.access_token ? encrypt(data.access_token) : data.access_token,
        refresh_token: data.refresh_token ? encrypt(data.refresh_token) : data.refresh_token,
        // PII-bearing JWT the app never reads back — don't store it (the
        // signIn event in auth.ts nulls it on every subsequent sign-in too).
        id_token: undefined,
      })
    }
  }

  return wrapped
}

export function decryptToken(value: string): string {
  return decrypt(value)
}
