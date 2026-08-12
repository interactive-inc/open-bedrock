import { SystemAuditJsonError } from "@/contexts/system/domain/audit/system-audit-json-error"
import type { SystemAuditJsonValue } from "@/contexts/system/domain/audit/system-audit-json-value"
import { toStableSystemAuditJson } from "@/contexts/system/domain/audit/to-stable-system-audit-json"
import { PayloadTooLargeError, ValidationError } from "@/lib/errors"

export type AuditJsonValue = SystemAuditJsonValue

/** System の監査 JSON エラーを既存の公開 application error 契約へ変換する。 */
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
