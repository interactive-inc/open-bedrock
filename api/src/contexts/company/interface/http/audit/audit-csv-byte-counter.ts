import type { AuditEventDetail } from "@/contexts/company/domain/audit/company-audit-event"
import { PayloadTooLargeError } from "@/lib/errors"
import {
  AUDIT_CSV_HEADER,
  AUDIT_CSV_MAX_BYTES,
  toAuditCsvRow,
} from "@/contexts/company/interface/http/audit/to-audit-csv-row"

const UTF8_ENCODER = new TextEncoder()

/** Incremental byte guard used by chunked repository export without retaining a second CSV copy. */
export class AuditCsvByteCounter {
  private byteLength = UTF8_ENCODER.encode(AUDIT_CSV_HEADER).byteLength

  get remainingBytes(): number {
    return AUDIT_CSV_MAX_BYTES - this.byteLength
  }

  add(row: AuditEventDetail): void {
    this.byteLength += UTF8_ENCODER.encode(toAuditCsvRow(row)).byteLength
    if (this.byteLength > AUDIT_CSV_MAX_BYTES) {
      throw new PayloadTooLargeError("audit export is too large", "audit_export_too_large")
    }
  }
}
