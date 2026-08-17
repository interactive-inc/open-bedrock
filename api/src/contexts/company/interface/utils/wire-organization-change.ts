import type { OrganizationChangeSet } from "@/contexts/company/application/workforce/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { organizationUnitKinds } from "@/contexts/company/domain/workforce/organization-unit"
import { orgAssignmentTypes } from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { isoDate } from "@/lib/schemas"
import { z } from "zod"

const workforceIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
const responsibilityTypeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/)
const auditFieldSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim() === value)
const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => {
    const timestamp = Date.parse(value)

    return Number.isSafeInteger(timestamp) && timestamp >= 0
  })
const periodSchema = z.strictObject({
  period_id: workforceIdSchema,
  revision: z.number().int().positive(),
  starts_on: isoDate,
  ends_on: isoDate.nullable(),
  is_void: z.boolean(),
})

export const wireOrganizationChangeSchema = z.strictObject({
  operation_id: workforceIdSchema,
  expected_revision: z.number().int().nonnegative(),
  as_of: isoDate,
  recorded_at: timestampSchema,
  reason: auditFieldSchema(1_000),
  evidence_references: z
    .array(
      z.strictObject({
        context: auditFieldSchema(100),
        kind: auditFieldSchema(100),
        id: auditFieldSchema(512),
        version: auditFieldSchema(255),
      }),
    )
    .max(100),
  organization_units: z
    .array(z.strictObject({ organization_unit_id: workforceIdSchema, created_at: timestampSchema }))
    .max(1_000),
  unit_periods: z
    .array(
      periodSchema.extend({
        organization_unit_id: workforceIdSchema,
        code: z
          .string()
          .min(1)
          .max(64)
          .refine((value) => value.trim() === value),
        official_name: z
          .string()
          .min(1)
          .max(200)
          .refine((value) => value.trim() === value),
        kind: z.enum(organizationUnitKinds),
        parent_organization_unit_id: workforceIdSchema.nullable(),
      }),
    )
    .max(1_000),
  assignments: z
    .array(
      periodSchema.extend({
        employment_id: workforceIdSchema,
        employee_id: workforceIdSchema,
        organization_unit_id: workforceIdSchema,
        assignment_type: z.enum(orgAssignmentTypes),
        position_title: z
          .string()
          .min(1)
          .max(200)
          .refine((value) => value.trim() === value)
          .nullable(),
        manager_employee_id: workforceIdSchema.nullable(),
      }),
    )
    .max(1_000),
  responsibilities: z
    .array(
      periodSchema.extend({
        employment_id: workforceIdSchema,
        employee_id: workforceIdSchema,
        organization_unit_id: workforceIdSchema,
        responsibility_type: responsibilityTypeSchema,
      }),
    )
    .max(1_000),
})

export type WireOrganizationChange = z.infer<typeof wireOrganizationChangeSchema>

/** 外部wireを記録主体と時刻が一つのCompany変更commandへ復元する。 */
export function toOrganizationChangeSet(
  input: WireOrganizationChange,
  actorAccountId: string,
): OrganizationChangeSet {
  const operationId = restoreWorkforceId("personnel_action", input.operation_id)
  const recordedAt = Date.parse(input.recorded_at)

  return {
    operationId,
    expectedRevision: input.expected_revision,
    asOf: restoreCalendarDate(input.as_of),
    recordedAt,
    actorAccountId,
    reason: input.reason,
    evidenceReferences: input.evidence_references,
    organizationUnits: input.organization_units.map((unit) => ({
      id: restoreWorkforceId("organization_unit", unit.organization_unit_id),
      createdAt: Date.parse(unit.created_at),
    })),
    unitPeriods: input.unit_periods.map((period) => ({
      periodId: restoreWorkforceId("period", period.period_id),
      revision: period.revision,
      organizationUnitId: restoreWorkforceId("organization_unit", period.organization_unit_id),
      code: period.code,
      officialName: period.official_name,
      kind: period.kind,
      parentOrganizationUnitId:
        period.parent_organization_unit_id === null
          ? null
          : restoreWorkforceId("organization_unit", period.parent_organization_unit_id),
      startsOn: restoreCalendarDate(period.starts_on),
      endsOn: period.ends_on === null ? null : restoreCalendarDate(period.ends_on),
      isVoid: period.is_void,
      recordedByActionId: operationId,
      recordedAt,
    })),
    assignments: input.assignments.map((period) => ({
      periodId: restoreWorkforceId("period", period.period_id),
      revision: period.revision,
      employmentId: restoreWorkforceId("employment", period.employment_id),
      employeeId: restoreWorkforceId("employee", period.employee_id),
      organizationUnitId: restoreWorkforceId("organization_unit", period.organization_unit_id),
      assignmentType: period.assignment_type,
      positionTitle: period.position_title,
      managerEmployeeId:
        period.manager_employee_id === null
          ? null
          : restoreWorkforceId("employee", period.manager_employee_id),
      startsOn: restoreCalendarDate(period.starts_on),
      endsOn: period.ends_on === null ? null : restoreCalendarDate(period.ends_on),
      isVoid: period.is_void,
      recordedByActionId: operationId,
      recordedAt,
    })),
    responsibilities: input.responsibilities.map((period) => ({
      periodId: restoreWorkforceId("period", period.period_id),
      revision: period.revision,
      employmentId: restoreWorkforceId("employment", period.employment_id),
      employeeId: restoreWorkforceId("employee", period.employee_id),
      organizationUnitId: restoreWorkforceId("organization_unit", period.organization_unit_id),
      responsibilityType: period.responsibility_type,
      startsOn: restoreCalendarDate(period.starts_on),
      endsOn: period.ends_on === null ? null : restoreCalendarDate(period.ends_on),
      isVoid: period.is_void,
      recordedByActionId: operationId,
      recordedAt,
    })),
  }
}
