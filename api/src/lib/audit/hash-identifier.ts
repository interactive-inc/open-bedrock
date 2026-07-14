import { UnavailableError } from "@/lib/errors"

const auditIdentifierDomain = "open-karte:audit:identifier:v1\0"

/**
 * Rejects an absent or blank audit HMAC binding without normalizing its value.
 */
export function assertAuditHmacSecret(secret: string): void {
  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new UnavailableError("audit HMAC secret is not configured", "audit_hmac_secret_invalid")
  }
}

/**
 * Produces a correlation-safe identifier digest without persisting the source identifier.
 */
export async function hashAuditIdentifier(identifier: string, secret: string): Promise<string> {
  assertAuditHmacSecret(secret)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const message = `${auditIdentifierDomain}${identifier.trim().toLowerCase()}`
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))

  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
