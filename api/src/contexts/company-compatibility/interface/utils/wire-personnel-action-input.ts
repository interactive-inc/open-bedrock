import { codeSchema, isoDate } from "@/lib/schemas"
import { z } from "zod"

const eventFields = {
  employeeCode: codeSchema,
  eventOn: isoDate,
}

const positionCodeField = codeSchema.nullable()

const optionalPositionCodeField = codeSchema.nullable().optional()

const assignmentWireFields = {
  departmentCode: codeSchema,
  positionCode: positionCodeField,
  managerEmployeeCode: codeSchema.nullable(),
}

const assignmentTargetFields = {
  departmentCode: codeSchema,
  assignmentType: z.enum(["primary", "concurrent"]),
}

const hireWireSchema = z
  .object({
    kind: z.literal("hire"),
    employeeCode: codeSchema,
    employeeName: z.string().min(1).max(200),
    eventOn: isoDate,
    departmentCode: codeSchema.nullable().optional(),
    positionCode: optionalPositionCodeField,
    managerEmployeeCode: codeSchema.nullable().optional(),
  })
  .strict()

const rehireWireSchema = z
  .object({
    kind: z.literal("rehire"),
    ...eventFields,
    departmentCode: codeSchema.nullable().optional(),
    positionCode: optionalPositionCodeField,
    managerEmployeeCode: codeSchema.nullable().optional(),
  })
  .strict()

const primaryAssignmentStartedWireSchema = z
  .object({
    kind: z.literal("primary_assignment_started"),
    ...eventFields,
    ...assignmentWireFields,
  })
  .strict()

const transferredWireSchema = z
  .object({ kind: z.literal("transferred"), ...eventFields, ...assignmentWireFields })
  .strict()

const concurrentAssignmentStartedWireSchema = z
  .object({
    kind: z.literal("concurrent_assignment_started"),
    ...eventFields,
    ...assignmentWireFields,
  })
  .strict()

const assignmentEndedWireSchema = z
  .object({ kind: z.literal("assignment_ended"), ...eventFields, ...assignmentTargetFields })
  .strict()

const positionChangedWireSchema = z
  .object({
    kind: z.literal("position_changed"),
    ...eventFields,
    ...assignmentTargetFields,
    positionCode: codeSchema,
    changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
  })
  .strict()

const managerChangedWireSchema = z
  .object({
    kind: z.literal("manager_changed"),
    ...eventFields,
    ...assignmentTargetFields,
    managerEmployeeCode: codeSchema.nullable(),
  })
  .strict()

const departmentResponsibilityStartedWireSchema = z
  .object({
    kind: z.literal("department_responsibility_started"),
    ...eventFields,
    departmentCode: codeSchema,
  })
  .strict()

const departmentResponsibilityEndedWireSchema = z
  .object({
    kind: z.literal("department_responsibility_ended"),
    ...eventFields,
    departmentCode: codeSchema,
  })
  .strict()

const leaveStartedWireSchema = z
  .object({ kind: z.literal("leave_started"), ...eventFields })
  .strict()

const returnedWireSchema = z.object({ kind: z.literal("returned"), ...eventFields }).strict()

const retiredWireSchema = z
  .object({ kind: z.literal("retired"), employeeCode: codeSchema, retirementOn: isoDate })
  .strict()

const nonCorrectionWireSchemas = [
  hireWireSchema,
  rehireWireSchema,
  primaryAssignmentStartedWireSchema,
  transferredWireSchema,
  concurrentAssignmentStartedWireSchema,
  assignmentEndedWireSchema,
  positionChangedWireSchema,
  managerChangedWireSchema,
  departmentResponsibilityStartedWireSchema,
  departmentResponsibilityEndedWireSchema,
  leaveStartedWireSchema,
  returnedWireSchema,
  retiredWireSchema,
] as const

export const nonCorrectionWirePersonnelActionInputSchema = z.discriminatedUnion(
  "kind",
  nonCorrectionWireSchemas,
)

const correctedWireSchema = z
  .object({
    kind: z.literal("corrected"),
    eventOn: isoDate,
    correctsActionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2000),
    replacementAction: nonCorrectionWirePersonnelActionInputSchema,
  })
  .strict()

const legacyBaselineWireSchema = z
  .object({
    kind: z.literal("legacy_baseline"),
    ...eventFields,
    legacyStatus: z.enum(["active", "leave", "retired"]),
    departmentCode: codeSchema.nullable(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: codeSchema.nullable(),
  })
  .strict()

/**
 * 人事発令のワイヤ入力スキーマ。役職は自由入力文字列ではなく役職マスタの code で受ける。
 * ドメインの personnelActionInputSchema（positionTitle を保持）とは層が異なり、
 * resolve-personnel-action-position が code を検証してマスタの name に解決し、
 * ドメイン入力（positionTitle）へ変換する。役職を持たない種別はそのまま通す。
 * legacy_baseline は履歴の再生（backfill 専用）であり、マスタ以前の役職名を持つため
 * positionTitle のまま据え置く（HTTP からの正規経路では app 層が拒否する）
 */
export const wirePersonnelActionInputSchema = z.discriminatedUnion("kind", [
  ...nonCorrectionWireSchemas,
  correctedWireSchema,
  legacyBaselineWireSchema,
])

export type WirePersonnelActionInput = z.infer<typeof wirePersonnelActionInputSchema>

export type NonCorrectionWirePersonnelActionInput = z.infer<
  typeof nonCorrectionWirePersonnelActionInputSchema
>
