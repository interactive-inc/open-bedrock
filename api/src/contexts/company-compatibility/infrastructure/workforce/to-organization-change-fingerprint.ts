import type { OrganizationChangeSet } from "@/contexts/company/application/workforce/apply-organization-change"

/** operation IDを変更内容へ結び、同じcommandと異なる再利用を区別する。 */
export async function toOrganizationChangeFingerprint(
  change: OrganizationChangeSet,
): Promise<string> {
  const canonical = JSON.stringify([
    change.operationId,
    change.expectedRevision,
    change.asOf,
    change.recordedAt,
    change.actorAccountId,
    change.reason,
    change.evidenceReferences.map((reference) => [
      reference.context,
      reference.kind,
      reference.id,
      reference.version,
    ]),
    change.organizationUnits.map((unit) => [unit.id, unit.createdAt]),
    change.unitPeriods.map((period) => [
      period.periodId,
      period.revision,
      period.organizationUnitId,
      period.code,
      period.officialName,
      period.kind,
      period.parentOrganizationUnitId,
      period.startsOn,
      period.endsOn,
      period.isVoid,
      period.recordedByActionId,
      period.recordedAt,
    ]),
    change.assignments.map((period) => [
      period.periodId,
      period.revision,
      period.employmentId,
      period.employeeId,
      period.organizationUnitId,
      period.assignmentType,
      period.positionTitle,
      period.managerEmployeeId,
      period.startsOn,
      period.endsOn,
      period.isVoid,
      period.recordedByActionId,
      period.recordedAt,
    ]),
    change.responsibilities.map((period) => [
      period.periodId,
      period.revision,
      period.employmentId,
      period.employeeId,
      period.organizationUnitId,
      period.responsibilityType,
      period.startsOn,
      period.endsOn,
      period.isVoid,
      period.recordedByActionId,
      period.recordedAt,
    ]),
  ])
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
