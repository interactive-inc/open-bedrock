import { ValidationError } from "@/lib/errors"
import { z } from "zod"

const MAX_CURSOR_LENGTH = 256
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u

const auditCursorPositionSchema = z.strictObject({
  version: z.literal(1),
  direction: z.enum(["next", "previous"]),
  createdAt: z.number().int().safe(),
  id: z.number().int().safe(),
})

export type AuditCursorPosition = z.infer<typeof auditCursorPositionSchema>

function invalidCursor(cause?: unknown): ValidationError {
  return new ValidationError("audit cursor is invalid", "invalid_audit_cursor", { cause })
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function base64UrlToBytes(token: string): Uint8Array {
  const paddingLength = (4 - (token.length % 4)) % 4
  const base64 = token.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(paddingLength)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

/** Encodes a pagination position using the one canonical unsigned cursor representation. */
export function encodeAuditCursor(position: AuditCursorPosition): string {
  const parsed = auditCursorPositionSchema.safeParse(position)
  if (!parsed.success) throw invalidCursor(parsed.error)

  const json = JSON.stringify({
    version: parsed.data.version,
    direction: parsed.data.direction,
    createdAt: parsed.data.createdAt,
    id: parsed.data.id,
  })
  const token = bytesToBase64Url(new TextEncoder().encode(json))

  if (token.length > MAX_CURSOR_LENGTH) throw invalidCursor()

  return token
}

/** Decodes only strict, canonical base64url cursor tokens. Cursors are positions, not authorization. */
export function decodeAuditCursor(token: string): AuditCursorPosition {
  try {
    if (
      typeof token !== "string" ||
      token.length === 0 ||
      token.length > MAX_CURSOR_LENGTH ||
      !BASE64URL_PATTERN.test(token)
    ) {
      throw invalidCursor()
    }

    const json = new TextDecoder("utf-8", { fatal: true }).decode(base64UrlToBytes(token))
    const value: unknown = JSON.parse(json)
    const parsed = auditCursorPositionSchema.safeParse(value)
    if (!parsed.success) throw invalidCursor(parsed.error)

    if (encodeAuditCursor(parsed.data) !== token) throw invalidCursor()

    return parsed.data
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw invalidCursor(error)
  }
}
