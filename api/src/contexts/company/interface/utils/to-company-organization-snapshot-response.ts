import type { ReadOrganizationWorkforceStateResult } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { periodContainsDate } from "@/contexts/company/domain/workforce/period-contains-date"
import { toCompanyAssignmentResponse } from "@/contexts/company/interface/utils/to-company-assignment-response"
import { toCompanyResponsibilityResponse } from "@/contexts/company/interface/utils/to-company-responsibility-response"

type Found = Extract<ReadOrganizationWorkforceStateResult, Readonly<{ kind: "found" }>>

/** 固定済みCompany組織snapshotから指定時点に有効な公開事実だけを返す。 */
export function toCompanyOrganizationSnapshotResponse(found: Found) {
  return {
    as_of: found.organization.asOf,
    organization_revision: found.organization.revision,
    organization_units: found.organization.units
      .filter((unit) => !unit.isVoid && periodContainsDate(unit, found.organization.asOf))
      .map((unit) => ({
        period_id: unit.periodId,
        revision: unit.revision,
        organization_unit_id: unit.organizationUnitId,
        code: unit.code,
        official_name: unit.officialName,
        kind: unit.kind,
        parent_organization_unit_id: unit.parentOrganizationUnitId,
        starts_on: unit.startsOn,
        ends_on: unit.endsOn,
        is_void: unit.isVoid,
        recorded_by_operation_id: unit.recordedByActionId,
        recorded_at: new Date(unit.recordedAt).toISOString(),
      })),
    assignments: found.employees.flatMap((employee) => [
      ...(employee.primaryAssignment === null
        ? []
        : [toCompanyAssignmentResponse(employee.primaryAssignment)]),
      ...employee.concurrentAssignments.map(toCompanyAssignmentResponse),
    ]),
    responsibilities: found.employees.flatMap((employee) =>
      employee.responsibilities.map(toCompanyResponsibilityResponse),
    ),
  }
}
