import type { AuditEventDetail } from "@/domain/audit/audit-event"
import { PayloadTooLargeError } from "@/lib/errors"

export const AUDIT_CSV_MAX_BYTES = 16 * 1024 * 1024

const COLUMNS = [
  "event_id",
  "request_id",
  "actor_account_id",
  "actor_employee_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
  "client_ip",
  "client_name",
  "created_at",
] as const

const HEADER = `${COLUMNS.join(",")}\r\n`
const FORMULA_PREFIX = /^[ \t\r\n]*[=+\-@]/u
const NEEDS_RFC4180_QUOTES = /[",\r\n]/u
const UTF8_ENCODER = new TextEncoder()

function exportTooLarge(): PayloadTooLargeError {
  return new PayloadTooLargeError("audit export is too large", "audit_export_too_large")
}

function encodeField(value: string | number | null): string {
  let text = value === null ? "" : String(value)
  if (FORMULA_PREFIX.test(text)) text = `'${text}`

  if (NEEDS_RFC4180_QUOTES.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function encodeRow(row: AuditEventDetail): string {
  const fields: ReadonlyArray<string | number | null> = [
    row.eventId,
    row.requestId,
    row.actorAccountId,
    row.actorEmployeeId,
    row.action,
    row.targetType,
    row.targetId,
    row.outcome,
    row.reasonCode,
    row.authorizationJson,
    row.beforeJson,
    row.afterJson,
    row.metadataJson,
    row.clientIp,
    row.clientName,
    new Date(row.createdAt * 1_000).toISOString(),
  ]

  return `${fields.map(encodeField).join(",")}\r\n`
}

/** Incremental byte guard used by chunked repository export without retaining a second CSV copy. */
export class AuditCsvByteCounter {
  private byteLength = UTF8_ENCODER.encode(HEADER).byteLength

  add(row: AuditEventDetail): void {
    this.byteLength += UTF8_ENCODER.encode(encodeRow(row)).byteLength
    if (this.byteLength > AUDIT_CSV_MAX_BYTES) throw exportTooLarge()
  }
}

/** Renders an RFC 4180 audit export with a fixed header and a fail-closed UTF-8 byte cap. */
export function toAuditCsv(rows: ReadonlyArray<AuditEventDetail>): string {
  const chunks = [HEADER]
  let byteLength = UTF8_ENCODER.encode(HEADER).byteLength

  for (const row of rows) {
    const encoded = encodeRow(row)
    byteLength += UTF8_ENCODER.encode(encoded).byteLength
    if (byteLength > AUDIT_CSV_MAX_BYTES) throw exportTooLarge()
    chunks.push(encoded)
  }

  return chunks.join("")
}
