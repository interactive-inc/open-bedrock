import {
  nonCorrectionPersonnelActionInputSchema,
  personnelActionInputSchema,
  type PersonnelActionInput,
} from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import {
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { z } from "zod"

const code = z.string().trim().min(1).max(64)
const date = z.string().date()
const eventFields = { employeeCode: code, eventOn: date }
const assignmentFields = {
  departmentCode: code,
  positionCode: code.nullable(),
  managerEmployeeCode: code.nullable(),
}
const assignmentTargetFields = {
  departmentCode: code,
  assignmentType: z.enum(["primary", "concurrent"]),
}
const hire = z.strictObject({
  kind: z.literal("hire"),
  employeeCode: code,
  employeeName: z.string().trim().min(1).max(200),
  eventOn: date,
  departmentCode: code.nullable().optional(),
  positionCode: code.nullable().optional(),
  managerEmployeeCode: code.nullable().optional(),
})
const rehire = z.strictObject({
  kind: z.literal("rehire"),
  ...eventFields,
  departmentCode: code.nullable().optional(),
  positionCode: code.nullable().optional(),
  managerEmployeeCode: code.nullable().optional(),
})
const primaryAssignmentStarted = z.strictObject({
  kind: z.literal("primary_assignment_started"),
  ...eventFields,
  ...assignmentFields,
})
const transferred = z.strictObject({
  kind: z.literal("transferred"),
  ...eventFields,
  ...assignmentFields,
})
const concurrentAssignmentStarted = z.strictObject({
  kind: z.literal("concurrent_assignment_started"),
  ...eventFields,
  ...assignmentFields,
})
const assignmentEnded = z.strictObject({
  kind: z.literal("assignment_ended"),
  ...eventFields,
  ...assignmentTargetFields,
})
const positionChanged = z.strictObject({
  kind: z.literal("position_changed"),
  ...eventFields,
  ...assignmentTargetFields,
  positionCode: code,
  changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
})
const managerChanged = z.strictObject({
  kind: z.literal("manager_changed"),
  ...eventFields,
  ...assignmentTargetFields,
  managerEmployeeCode: code.nullable(),
})
const departmentResponsibilityStarted = z.strictObject({
  kind: z.literal("department_responsibility_started"),
  ...eventFields,
  departmentCode: code,
})
const departmentResponsibilityEnded = z.strictObject({
  kind: z.literal("department_responsibility_ended"),
  ...eventFields,
  departmentCode: code,
})
const leaveStarted = z.strictObject({ kind: z.literal("leave_started"), ...eventFields })
const returned = z.strictObject({ kind: z.literal("returned"), ...eventFields })
const retired = z.strictObject({
  kind: z.literal("retired"),
  employeeCode: code,
  retirementOn: date,
})

const nonCorrectionSchemas = [
  hire,
  rehire,
  primaryAssignmentStarted,
  transferred,
  concurrentAssignmentStarted,
  assignmentEnded,
  positionChanged,
  managerChanged,
  departmentResponsibilityStarted,
  departmentResponsibilityEnded,
  leaveStarted,
  returned,
  retired,
] as const

const nonCorrectionWireSchema = z.discriminatedUnion("kind", nonCorrectionSchemas)
export const wirePersonnelActionInputSchema = z.discriminatedUnion("kind", [
  ...nonCorrectionSchemas,
  z.strictObject({
    kind: z.literal("corrected"),
    eventOn: date,
    correctsActionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2_000),
    replacementAction: nonCorrectionWireSchema,
  }),
])

type NonCorrectionWireInput = z.infer<typeof nonCorrectionWireSchema>
export type WirePersonnelActionInput = z.infer<typeof wirePersonnelActionInputSchema>

async function resolvePositionTitle(
  repository: PositionRepository,
  codeValue: string | null | undefined,
): Promise<string | null | CompanyOperationError> {
  if (codeValue === null || codeValue === undefined) return null
  const position = await repository.findByCode(codeValue)
  if (position instanceof Error) {
    return new CompanyUnexpectedError("役職を取得できません", { cause: position })
  }
  return position === null
    ? new CompanyValidationError("役職コードが見つかりません", "invalid_change")
    : position.toProps().name
}

async function resolveNonCorrection(
  repository: PositionRepository,
  action: NonCorrectionWireInput,
): Promise<unknown> {
  if (
    action.kind === "hire" ||
    action.kind === "rehire" ||
    action.kind === "primary_assignment_started" ||
    action.kind === "transferred" ||
    action.kind === "concurrent_assignment_started"
  ) {
    if (action.departmentCode == null && action.positionCode != null) {
      return new CompanyValidationError(
        "役職は配属先組織とあわせて指定してください",
        "invalid_change",
      )
    }
    const positionTitle = await resolvePositionTitle(repository, action.positionCode)
    if (positionTitle instanceof CompanyOperationError) return positionTitle
    const { positionCode: _positionCode, ...rest } = action
    return { ...rest, positionTitle }
  }
  if (action.kind === "position_changed") {
    const positionTitle = await resolvePositionTitle(repository, action.positionCode)
    if (positionTitle instanceof CompanyOperationError) return positionTitle
    if (positionTitle === null) {
      return new CompanyValidationError("役職コードが必要です", "invalid_change")
    }
    const { positionCode: _positionCode, ...rest } = action
    return { ...rest, positionTitle }
  }
  return action
}

/** HTTPの役職codeをCompanyの正規な役職名へ解決し、発令入力を確定する。 */
export async function resolvePersonnelActionInput(
  context: CompanyContext,
  wire: WirePersonnelActionInput,
): Promise<PersonnelActionInput | CompanyOperationError> {
  const repository = new PositionRepository(context)
  if (wire.kind === "corrected") {
    const replacement = await resolveNonCorrection(repository, wire.replacementAction)
    if (replacement instanceof CompanyOperationError) return replacement
    const parsedReplacement = nonCorrectionPersonnelActionInputSchema.safeParse(replacement)
    if (!parsedReplacement.success) {
      return new CompanyValidationError(
        "人事発令が不正です",
        "personnel_action_invalid_transition",
        { cause: parsedReplacement.error },
      )
    }
    const parsed = personnelActionInputSchema.safeParse({
      ...wire,
      replacementAction: parsedReplacement.data,
    })
    return parsed.success
      ? parsed.data
      : new CompanyValidationError("人事発令が不正です", "personnel_action_invalid_transition", {
          cause: parsed.error,
        })
  }
  const resolved = await resolveNonCorrection(repository, wire)
  if (resolved instanceof CompanyOperationError) return resolved
  const parsed = personnelActionInputSchema.safeParse(resolved)
  return parsed.success
    ? parsed.data
    : new CompanyValidationError("人事発令が不正です", "personnel_action_invalid_transition", {
        cause: parsed.error,
      })
}
