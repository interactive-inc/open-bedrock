import type { Context } from "@/env"
import {
  nonCorrectionPersonnelActionInputSchema,
  personnelActionInputSchema,
  type PersonnelActionInput,
} from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type {
  NonCorrectionWirePersonnelActionInput,
  WirePersonnelActionInput,
} from "@/contexts/administration/interface/utils/wire-personnel-action-input"
import { PositionRepository } from "@/contexts/administration/infrastructure/position/position.repository"
import { positionRequiresDepartment } from "@/contexts/administration/interface/utils/position-requires-department"
import { ApplicationError, UnexpectedError, UnprocessableError } from "@/lib/errors"

/**
 * 役職 code をマスタ名に解決する。null は役職なしとして通す。
 * マスタに存在しない code は 422、マスタ参照の失敗は 500 を返す。
 */
async function resolvePositionName(
  repository: PositionRepository,
  code: string | null | undefined,
): Promise<string | null | ApplicationError> {
  if (code === null || code === undefined) {
    return null
  }

  const position = await repository.findByCode(code)

  if (position instanceof Error) {
    return new UnexpectedError("failed to resolve position code", {
      cause: position,
    })
  }

  if (position === null) {
    return new UnprocessableError("position code not found", "position_code_not_found")
  }

  return position.name
}

/**
 * 役職を持たない種別はワイヤとドメインの形が同一なのでそのまま通す。
 * 役職を持つ種別のみ positionCode を name へ解決し positionTitle として組み直す。
 */
async function resolveNonCorrection(
  repository: PositionRepository,
  action: NonCorrectionWirePersonnelActionInput,
): Promise<unknown | ApplicationError> {
  if (action.kind === "hire") {
    if (positionRequiresDepartment(action.departmentCode ?? null, action.positionCode ?? null)) {
      return new UnprocessableError(
        "役職は配属先部署とあわせて指定してください",
        "position_requires_department",
      )
    }

    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    return {
      kind: "hire",
      employeeCode: action.employeeCode,
      employeeName: action.employeeName,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      positionTitle,
      managerEmployeeCode: action.managerEmployeeCode,
    }
  }

  if (action.kind === "rehire") {
    if (positionRequiresDepartment(action.departmentCode ?? null, action.positionCode ?? null)) {
      return new UnprocessableError(
        "役職は配属先部署とあわせて指定してください",
        "position_requires_department",
      )
    }

    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    return {
      kind: "rehire",
      employeeCode: action.employeeCode,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      positionTitle,
      managerEmployeeCode: action.managerEmployeeCode,
    }
  }

  if (action.kind === "primary_assignment_started") {
    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    return {
      kind: "primary_assignment_started",
      employeeCode: action.employeeCode,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      positionTitle,
      managerEmployeeCode: action.managerEmployeeCode,
    }
  }

  if (action.kind === "transferred") {
    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    return {
      kind: "transferred",
      employeeCode: action.employeeCode,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      positionTitle,
      managerEmployeeCode: action.managerEmployeeCode,
    }
  }

  if (action.kind === "concurrent_assignment_started") {
    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    return {
      kind: "concurrent_assignment_started",
      employeeCode: action.employeeCode,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      positionTitle,
      managerEmployeeCode: action.managerEmployeeCode,
    }
  }

  if (action.kind === "position_changed") {
    const positionTitle = await resolvePositionName(repository, action.positionCode)

    if (positionTitle instanceof ApplicationError) {
      return positionTitle
    }

    if (positionTitle === null) {
      return new UnprocessableError("position code is required", "position_code_required")
    }

    return {
      kind: "position_changed",
      employeeCode: action.employeeCode,
      eventOn: action.eventOn,
      departmentCode: action.departmentCode,
      assignmentType: action.assignmentType,
      positionTitle,
      changeType: action.changeType,
    }
  }

  return action
}

/**
 * 人事発令のワイヤ入力を検証済みドメイン入力へ解決する。
 * 役職 code をマスタ名に置き換え、存在しない code は 422 を返す。
 * corrected は replacementAction も同じ正規入力へ解決する。
 */
export async function resolvePersonnelActionPosition(
  c: Context,
  action: WirePersonnelActionInput,
): Promise<PersonnelActionInput | ApplicationError> {
  const repository = new PositionRepository(c)

  if (action.kind === "corrected") {
    const replacementAction = await resolveNonCorrection(repository, action.replacementAction)

    if (replacementAction instanceof ApplicationError) {
      return replacementAction
    }

    const parsedReplacement = nonCorrectionPersonnelActionInputSchema.safeParse(replacementAction)
    if (!parsedReplacement.success) {
      return new UnprocessableError("人事発令が不正です", "personnel_action_invalid_transition")
    }

    const parsed = personnelActionInputSchema.safeParse({
      kind: "corrected",
      eventOn: action.eventOn,
      correctsActionId: action.correctsActionId,
      reason: action.reason,
      replacementAction: parsedReplacement.data,
    })
    return parsed.success
      ? parsed.data
      : new UnprocessableError("人事発令が不正です", "personnel_action_invalid_transition")
  }

  const resolved = await resolveNonCorrection(repository, action)
  if (resolved instanceof ApplicationError) return resolved
  const parsed = personnelActionInputSchema.safeParse(resolved)
  return parsed.success
    ? parsed.data
    : new UnprocessableError("人事発令が不正です", "personnel_action_invalid_transition")
}
