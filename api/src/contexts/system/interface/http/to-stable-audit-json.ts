import { SystemAuditJsonError } from "@system/domain/audit/system-audit-json-error"
import type { SystemAuditJsonValue } from "@system/domain/audit/system-audit-json-value"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { PayloadTooLargeError, ValidationError } from "@/lib/errors/portable-errors"

export type AuditJsonValue = SystemAuditJsonValue

/** Systemの監査JSON結果を製品共通の公開application error契約へ変換する。 */
export function toStableAuditJson(value: AuditJsonValue): string | null {
  const serialized = toStableSystemAuditJson(value)

  if (!(serialized instanceof SystemAuditJsonError)) return serialized

  if (serialized.code === "payload_too_large") {
    throw new PayloadTooLargeError(
      "audit JSON exceeds the 64 KiB limit",
      "audit_payload_too_large",
      {
        cause: serialized,
      },
    )
  }

  throw new ValidationError("audit JSON contains an unsupported value", "audit_invalid_json", {
    cause: serialized,
  })
}
