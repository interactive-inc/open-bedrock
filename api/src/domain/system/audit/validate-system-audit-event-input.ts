import { isValidSystemAuditJson } from "@/domain/system/audit/is-valid-system-audit-json"
import type { SystemAuditEventInput } from "@/domain/system/audit/system-audit-event"

const vocabularyPattern = /^[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u

/** 保存方式に依存しないSystem監査イベントのscalar不変条件を検査する。 */
export function validateSystemAuditEventInput(input: SystemAuditEventInput): Error | null {
  const actor = input.actorAccountId
  if (
    actor !== null &&
    (typeof actor !== "string" || actor.trim().length === 0 || actor.length > 256)
  ) {
    return new Error("audit actor identifier is invalid")
  }
  if (
    typeof input.action !== "string" ||
    input.action.length > 200 ||
    !vocabularyPattern.test(input.action)
  ) {
    return new Error("audit action is invalid")
  }
  if (
    typeof input.targetType !== "string" ||
    input.targetType.length > 100 ||
    !vocabularyPattern.test(input.targetType)
  ) {
    return new Error("audit target type is invalid")
  }
  if (
    input.targetId !== null &&
    (typeof input.targetId !== "string" ||
      input.targetId.length === 0 ||
      input.targetId.length > 512)
  ) {
    return new Error("audit target identifier is invalid")
  }
  if (input.outcome !== "succeeded" && input.outcome !== "denied" && input.outcome !== "failed") {
    return new Error("audit outcome is invalid")
  }
  if (
    input.reasonCode !== null &&
    (typeof input.reasonCode !== "string" ||
      input.reasonCode.length === 0 ||
      input.reasonCode.length > 200)
  ) {
    return new Error("audit reason code is invalid")
  }
  if (
    !isValidSystemAuditJson(input.authorizationJson) ||
    !isValidSystemAuditJson(input.beforeJson) ||
    !isValidSystemAuditJson(input.afterJson) ||
    !isValidSystemAuditJson(input.metadataJson)
  ) {
    return new Error("audit JSON is invalid")
  }
  if (!(input.occurredAt instanceof Date)) return new Error("audit timestamp is invalid")
  if (!Number.isFinite(Date.prototype.getTime.call(input.occurredAt))) {
    return new Error("audit timestamp is invalid")
  }

  return null
}
