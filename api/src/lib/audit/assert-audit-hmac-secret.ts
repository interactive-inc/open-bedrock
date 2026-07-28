import { UnavailableError } from "@/lib/errors"

/**
 * Rejects an absent or blank audit HMAC binding without normalizing its value.
 */
export function assertAuditHmacSecret(secret: string): void {
  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new UnavailableError("audit HMAC secret is not configured", "audit_hmac_secret_invalid")
  }
}
