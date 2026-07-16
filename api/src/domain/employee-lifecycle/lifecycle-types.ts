import { codeSchema, isoDate } from "@/lib/schemas"
import { z } from "zod"

export const lifecycleEmployeeStatusSchema = z.enum(["prehire", "active", "leave", "retired"])

export type LifecycleEmployeeStatus = z.infer<typeof lifecycleEmployeeStatusSchema>

export const personnelActionKindSchema = z.enum([
  "hire",
  "rehire",
  "primary_assignment_started",
  "transferred",
  "concurrent_assignment_started",
  "assignment_ended",
  "position_changed",
  "manager_changed",
  "department_responsibility_started",
  "department_responsibility_ended",
  "leave_started",
  "returned",
  "retired",
  "corrected",
  "legacy_baseline",
])

export type PersonnelActionKind = z.infer<typeof personnelActionKindSchema>

export const LIFECYCLE_ERROR_CODES = [
  "lifecycle_action_required",
  "invalid_lifecycle_cursor",
  "personnel_action_stale",
  "employment_period_conflict",
  "status_period_conflict",
  "primary_assignment_conflict",
  "assignment_period_conflict",
  "manager_cycle",
  "manager_not_active",
  "department_not_active",
  "personnel_action_invalid_transition",
  "personnel_action_already_corrected",
  "idempotency_conflict",
  "company_timezone_unavailable",
  "employee_archive_required",
  "employee_not_retired",
  "lifecycle_migration_incomplete",
  "lifecycle_projection_mismatch",
] as const

export const lifecycleErrorCodeSchema = z.enum(LIFECYCLE_ERROR_CODES)

export type LifecycleErrorCode = z.infer<typeof lifecycleErrorCodeSchema>

const eventFields = {
  employeeCode: codeSchema,
  eventOn: isoDate,
}

const assignmentFields = {
  departmentCode: codeSchema,
  positionTitle: z.string().min(1).max(200).nullable(),
  managerEmployeeCode: codeSchema.nullable(),
}

const assignmentTargetFields = {
  departmentCode: codeSchema,
  assignmentType: z.enum(["primary", "concurrent"]),
}

const hireActionSchema = z
  .object({
    kind: z.literal("hire"),
    employeeCode: codeSchema,
    employeeName: z.string().min(1).max(200),
    eventOn: isoDate,
    departmentCode: codeSchema.nullable().optional(),
    positionTitle: z.string().min(1).max(200).nullable().optional(),
    managerEmployeeCode: codeSchema.nullable().optional(),
  })
  .strict()

const rehireActionSchema = z
  .object({
    kind: z.literal("rehire"),
    ...eventFields,
    departmentCode: codeSchema.nullable().optional(),
    positionTitle: z.string().min(1).max(200).nullable().optional(),
    managerEmployeeCode: codeSchema.nullable().optional(),
  })
  .strict()

const primaryAssignmentStartedActionSchema = z
  .object({
    kind: z.literal("primary_assignment_started"),
    ...eventFields,
    ...assignmentFields,
  })
  .strict()

const transferredActionSchema = z
  .object({ kind: z.literal("transferred"), ...eventFields, ...assignmentFields })
  .strict()

const concurrentAssignmentStartedActionSchema = z
  .object({
    kind: z.literal("concurrent_assignment_started"),
    ...eventFields,
    ...assignmentFields,
  })
  .strict()

const assignmentEndedActionSchema = z
  .object({ kind: z.literal("assignment_ended"), ...eventFields, ...assignmentTargetFields })
  .strict()

const positionChangedActionSchema = z
  .object({
    kind: z.literal("position_changed"),
    ...eventFields,
    ...assignmentTargetFields,
    positionTitle: z.string().min(1).max(200),
    changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
  })
  .strict()

const managerChangedActionSchema = z
  .object({
    kind: z.literal("manager_changed"),
    ...eventFields,
    ...assignmentTargetFields,
    managerEmployeeCode: codeSchema.nullable(),
  })
  .strict()

const departmentResponsibilityStartedActionSchema = z
  .object({
    kind: z.literal("department_responsibility_started"),
    ...eventFields,
    departmentCode: codeSchema,
  })
  .strict()

const departmentResponsibilityEndedActionSchema = z
  .object({
    kind: z.literal("department_responsibility_ended"),
    ...eventFields,
    departmentCode: codeSchema,
  })
  .strict()

const leaveStartedActionSchema = z
  .object({ kind: z.literal("leave_started"), ...eventFields })
  .strict()

const returnedActionSchema = z.object({ kind: z.literal("returned"), ...eventFields }).strict()

const retiredActionSchema = z
  .object({ kind: z.literal("retired"), employeeCode: codeSchema, retirementOn: isoDate })
  .strict()

const nonCorrectionActionSchemas = [
  hireActionSchema,
  rehireActionSchema,
  primaryAssignmentStartedActionSchema,
  transferredActionSchema,
  concurrentAssignmentStartedActionSchema,
  assignmentEndedActionSchema,
  positionChangedActionSchema,
  managerChangedActionSchema,
  departmentResponsibilityStartedActionSchema,
  departmentResponsibilityEndedActionSchema,
  leaveStartedActionSchema,
  returnedActionSchema,
  retiredActionSchema,
] as const

export const nonCorrectionPersonnelActionInputSchema = z.discriminatedUnion(
  "kind",
  nonCorrectionActionSchemas,
)

const correctedActionSchema = z
  .object({
    kind: z.literal("corrected"),
    eventOn: isoDate,
    correctsActionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2000),
    replacementAction: nonCorrectionPersonnelActionInputSchema,
  })
  .strict()

const legacyBaselineActionSchema = z
  .object({
    kind: z.literal("legacy_baseline"),
    ...eventFields,
    legacyStatus: z.enum(["active", "leave", "retired"]),
    departmentCode: codeSchema.nullable(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: codeSchema.nullable(),
  })
  .strict()

export const personnelActionInputSchema = z.discriminatedUnion("kind", [
  ...nonCorrectionActionSchemas,
  correctedActionSchema,
  legacyBaselineActionSchema,
])

export type PersonnelActionInput = z.infer<typeof personnelActionInputSchema>
