import { auditEventNotFound } from "@/contexts/company-compatibility/interface/utils/audit-event-not-found"

const EVENT_ID_MAX_LENGTH = 64
const EVENT_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy-(?:0|[1-9][0-9]*|-[1-9][0-9]*))$/u

/** Validates the path without reflecting malformed input into an error or audit record. */
export function parseAuditEventId(value: string | undefined): string {
  if (value === undefined || value.length > EVENT_ID_MAX_LENGTH || !EVENT_ID_PATTERN.test(value)) {
    throw auditEventNotFound()
  }
  return value
}
