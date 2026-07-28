import { ValidationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { z } from "zod"

const MAX_CURSOR_LENGTH = 256

const wireSchema = z
  .object({
    v: z.literal(1),
    f: z.string().min(1).max(64),
    a: z.number().int().nonnegative(),
    p: z.tuple([isoDate, z.number().int().nonnegative(), z.string().uuid()]),
    l: z.number().int().min(1).max(100),
  })
  .strict()

export type LifecycleCursorValue = {
  version: 1
  filterFingerprint: string
  anchorRowId: number
  position: { eventOn: string; recordedAt: number; id: string }
  limit: number
}

function invalid(cause?: unknown): ValidationError {
  return new ValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor", { cause })
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

/**
 * HMAC 署名付きの履歴スキャン位置。改竄・上限超過・不正形式を fail-closed で弾く
 */
export class LifecycleCursor {
  static async encode(cursor: LifecycleCursorValue, secret: string): Promise<string> {
    const wire = wireSchema.parse({
      v: cursor.version,
      f: cursor.filterFingerprint,
      a: cursor.anchorRowId,
      p: [cursor.position.eventOn, cursor.position.recordedAt, cursor.position.id],
      l: cursor.limit,
    })
    const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(wire)))
    const encoded = `${payload}.${base64UrlEncode(await sign(payload, secret))}`
    if (encoded.length > MAX_CURSOR_LENGTH) throw invalid()
    return encoded
  }

  static async decode(
    encoded: string,
    secret: string,
  ): Promise<LifecycleCursorValue | ValidationError> {
    try {
      if (encoded.length === 0 || encoded.length > MAX_CURSOR_LENGTH) return invalid()
      const parts = encoded.split(".")
      if (parts.length !== 2) return invalid()
      const payload = parts[0]
      const signature = parts[1]
      if (payload === undefined || signature === undefined) return invalid()
      const expected = await sign(payload, secret)
      const actual = base64UrlDecode(signature)
      if (!equalBytes(expected, actual)) return invalid()
      const wire = wireSchema.parse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(payload))),
      )
      return {
        version: wire.v,
        filterFingerprint: wire.f,
        anchorRowId: wire.a,
        position: { eventOn: wire.p[0], recordedAt: wire.p[1], id: wire.p[2] },
        limit: wire.l,
      }
    } catch (cause) {
      return invalid(cause)
    }
  }
}
