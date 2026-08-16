import type { AuditEventFilters } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { toStableAuditJson } from "@/api/legacy-system/model/audit/legacy-stable-json"
import { auditUnavailable } from "@/contexts/company/interface/utils/audit-unavailable"

const FILTER_HASH_PREFIX = "open-karte:audit:filters:v1\0"

/** Hashes only normalized filter values, excluding cursor, limit and raw input spellings. */
export async function hashAuditFilters(filters: AuditEventFilters): Promise<string> {
  try {
    const normalized = {
      actor_account_id: filters.actorAccountId ?? null,
      action: filters.action ?? null,
      target_type: filters.targetType ?? null,
      target_id: filters.targetId ?? null,
      outcome: filters.outcome ?? null,
      from_epoch: filters.fromEpoch ?? null,
      to_epoch: filters.toEpoch ?? null,
    }
    const bytes = new TextEncoder().encode(`${FILTER_HASH_PREFIX}${toStableAuditJson(normalized)}`)
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch (error) {
    throw auditUnavailable(error)
  }
}
