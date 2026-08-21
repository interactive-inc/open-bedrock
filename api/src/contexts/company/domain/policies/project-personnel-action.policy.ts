import { applyLifecycleMutations } from "@/contexts/company/domain/policies/apply-lifecycle-mutations.policy"
import { containsDate } from "@/contexts/company/domain/values/contains-date.definition"
import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  LifecycleVersionMutation,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/values/lifecycle-schedule.definition"
import { normalizeLifecycleSchedule } from "@/contexts/company/domain/values/normalize-lifecycle-schedule.definition"
import {
  personnelActionInputSchema,
  type PersonnelActionInput,
} from "@/contexts/company/domain/values/lifecycle-types.definition"
import {
  personnelActionSummarySchema,
  type PersonnelActionSummary,
} from "@/contexts/company/domain/values/personnel-action-summary.definition"
import { validateLifecycleSchedules } from "@/contexts/company/domain/policies/validate-lifecycle-schedule.policy"
import { nextCalendarDate } from "@/contexts/company/domain/values/next-calendar-date.definition"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"

export type PersonnelActionProjection = {
  schedule: LifecycleSchedule
  mutations: ReadonlyArray<LifecycleVersionMutation>
  summary: PersonnelActionSummary
  affectsOrganization: boolean
}

export type LifecycleDepartmentReference = {
  code: string
  name: string
  archived: boolean
}

export type LifecycleEmployeeReference = {
  id: number
  code: string
}

export type PersonnelActionCommand = {
  actionId: string
  employeeId: number
  recordedAt: number
  input: PersonnelActionInput
  correction?: {
    mutations: ReadonlyArray<LifecycleVersionMutation>
    alreadyCorrected: boolean
  }
}

type ProjectPersonnelActionProps = {
  schedule: LifecycleSchedule
  organizationSchedules: ReadonlyArray<LifecycleSchedule>
  departments: ReadonlyArray<LifecycleDepartmentReference>
  employees: ReadonlyArray<LifecycleEmployeeReference>
  command: PersonnelActionCommand
}

type ProjectionContext = ProjectPersonnelActionProps & {
  schedule: LifecycleSchedule
  mutations: Array<LifecycleVersionMutation>
  counters: Record<"employment" | "status" | "assignment" | "responsibility", number>
}

function transitionError(message: string): CompanyOperationError {
  return new CompanyConflictError(message, "personnel_action_invalid_transition")
}

function newPeriodId(
  context: ProjectionContext,
  periodType: keyof ProjectionContext["counters"],
): string {
  context.counters[periodType] += 1
  return `${context.command.actionId}:${periodType}:${context.counters[periodType]}`
}

function recordMutation(context: ProjectionContext, mutation: LifecycleVersionMutation): void {
  context.mutations.push(mutation)
  context.schedule = applyLifecycleMutations(context.schedule, [mutation])
}

function revisedPeriod<T extends { revision: number }>(
  context: ProjectionContext,
  period: T,
  changes: Partial<T>,
): T {
  return {
    ...period,
    ...changes,
    revision: period.revision + 1,
    recordedByActionId: context.command.actionId,
    recordedAt: context.command.recordedAt,
  }
}

function closePeriod<
  T extends EmploymentPeriod | EmployeeStatusPeriod | OrgAssignmentPeriod | OrgResponsibilityPeriod,
>(
  context: ProjectionContext,
  periodType: LifecycleVersionMutation["periodType"],
  period: T,
  endsOn: string,
): void {
  const after = revisedPeriod(context, period, {
    endsOn: period.startsOn >= endsOn ? period.endsOn : endsOn,
    isVoid: period.startsOn >= endsOn,
  } as Partial<T>)

  recordMutation(context, { periodType, before: period, after } as LifecycleVersionMutation)
}

function department(
  context: ProjectionContext,
  code: string,
  requireActive = true,
): LifecycleDepartmentReference | CompanyOperationError {
  const reference = context.departments.find((candidate) => candidate.code === code)

  if (reference === undefined || (requireActive && reference.archived)) {
    return new CompanyConflictError("利用できない部署が指定されています", "department_not_active")
  }

  return reference
}

function employeeId(
  context: ProjectionContext,
  code: string | null,
): number | null | CompanyOperationError {
  if (code === null) {
    return null
  }

  const reference = context.employees.find((candidate) => candidate.code === code)

  return reference?.id ?? new CompanyConflictError("直属上司が見つかりません", "manager_not_active")
}

function employeeCode(context: ProjectionContext, id: number | null): string | null {
  if (id === null) {
    return null
  }

  return context.employees.find((candidate) => candidate.id === id)?.code ?? null
}

function employmentAt(
  context: ProjectionContext,
  date: string,
): EmploymentPeriod | CompanyOperationError {
  return (
    context.schedule.employments.find(
      (period) => period.employeeId === context.command.employeeId && containsDate(period, date),
    ) ?? transitionError("対象日に有効な雇用期間がありません")
  )
}

function assignmentAt(
  context: ProjectionContext,
  date: string,
  departmentCode: string,
  assignmentType: "primary" | "concurrent",
): OrgAssignmentPeriod | CompanyOperationError {
  return (
    context.schedule.assignments.find(
      (period) =>
        period.employeeId === context.command.employeeId &&
        period.departmentCode === departmentCode &&
        period.assignmentType === assignmentType &&
        containsDate(period, date),
    ) ?? transitionError("対象日に有効な所属期間がありません")
  )
}

function addEmployment(context: ProjectionContext, startsOn: string): EmploymentPeriod {
  const employment: EmploymentPeriod = {
    periodId: newPeriodId(context, "employment"),
    revision: 1,
    employeeId: context.command.employeeId,
    startsOn,
    endsOn: null,
    isVoid: false,
    recordedByActionId: context.command.actionId,
    recordedAt: context.command.recordedAt,
  }
  recordMutation(context, { periodType: "employment", before: null, after: employment })
  return employment
}

function addStatus(
  context: ProjectionContext,
  employment: EmploymentPeriod,
  status: "active" | "leave",
  startsOn: string,
): EmployeeStatusPeriod {
  const period: EmployeeStatusPeriod = {
    periodId: newPeriodId(context, "status"),
    revision: 1,
    employmentPeriodId: employment.periodId,
    employeeId: context.command.employeeId,
    status,
    startsOn,
    endsOn: employment.endsOn,
    isVoid: false,
    recordedByActionId: context.command.actionId,
    recordedAt: context.command.recordedAt,
  }
  recordMutation(context, { periodType: "status", before: null, after: period })
  return period
}

function addAssignment(
  context: ProjectionContext,
  props: {
    employment: EmploymentPeriod
    startsOn: string
    departmentCode: string
    assignmentType: "primary" | "concurrent"
    positionTitle: string | null
    managerEmployeeId: number | null
  },
): OrgAssignmentPeriod {
  const period: OrgAssignmentPeriod = {
    periodId: newPeriodId(context, "assignment"),
    revision: 1,
    employmentPeriodId: props.employment.periodId,
    employeeId: context.command.employeeId,
    departmentCode: props.departmentCode,
    assignmentType: props.assignmentType,
    positionTitle: props.positionTitle,
    managerEmployeeId: props.managerEmployeeId,
    startsOn: props.startsOn,
    endsOn: props.employment.endsOn,
    isVoid: false,
    recordedByActionId: context.command.actionId,
    recordedAt: context.command.recordedAt,
  }
  recordMutation(context, { periodType: "assignment", before: null, after: period })
  return period
}

function projectHireOrRehire(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "hire" | "rehire" }>,
): PersonnelActionSummary | CompanyOperationError {
  const employment = addEmployment(context, input.eventOn)
  addStatus(context, employment, "active", input.eventOn)

  const departmentCode = input.departmentCode ?? null
  let snapshot: { code: string; name: string } | null = null

  if (departmentCode !== null) {
    const departmentReference = department(context, departmentCode)

    if (departmentReference instanceof CompanyOperationError) {
      return departmentReference
    }

    const managerId = employeeId(context, input.managerEmployeeCode ?? null)

    if (managerId instanceof CompanyOperationError) {
      return managerId
    }

    addAssignment(context, {
      employment,
      startsOn: input.eventOn,
      departmentCode,
      assignmentType: "primary",
      positionTitle: input.positionTitle ?? null,
      managerEmployeeId: managerId,
    })
    snapshot = { code: departmentReference.code, name: departmentReference.name }
  }

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: snapshot,
    positionTitle: input.positionTitle ?? null,
    managerEmployeeCode: input.managerEmployeeCode ?? null,
    status: "active",
  })
}

function projectAssignmentStart(
  context: ProjectionContext,
  input: Extract<
    PersonnelActionInput,
    { kind: "primary_assignment_started" | "concurrent_assignment_started" | "transferred" }
  >,
): PersonnelActionSummary | CompanyOperationError {
  const employment = employmentAt(context, input.eventOn)

  if (employment instanceof CompanyOperationError) {
    return employment
  }

  const departmentReference = department(context, input.departmentCode)

  if (departmentReference instanceof CompanyOperationError) {
    return departmentReference
  }

  const managerId = employeeId(context, input.managerEmployeeCode)

  if (managerId instanceof CompanyOperationError) {
    return managerId
  }

  const assignmentType = input.kind === "concurrent_assignment_started" ? "concurrent" : "primary"

  if (input.kind === "transferred") {
    const current = context.schedule.assignments.find(
      (period) =>
        period.employeeId === context.command.employeeId &&
        period.assignmentType === "primary" &&
        containsDate(period, input.eventOn),
    )

    if (current === undefined) {
      return transitionError("異動元の主所属がありません")
    }

    closePeriod(context, "assignment", current, input.eventOn)
  }

  addAssignment(context, {
    employment,
    startsOn: input.eventOn,
    departmentCode: input.departmentCode,
    assignmentType,
    positionTitle: input.positionTitle,
    managerEmployeeId: managerId,
  })

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: { code: departmentReference.code, name: departmentReference.name },
    assignmentType,
    positionTitle: input.positionTitle,
    managerEmployeeCode: input.managerEmployeeCode,
  })
}

function projectAssignmentEnd(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "assignment_ended" }>,
): PersonnelActionSummary | CompanyOperationError {
  const current = assignmentAt(context, input.eventOn, input.departmentCode, input.assignmentType)

  if (current instanceof CompanyOperationError) {
    return current
  }

  const departmentReference = department(context, input.departmentCode, false)

  if (departmentReference instanceof CompanyOperationError) {
    return departmentReference
  }

  closePeriod(context, "assignment", current, input.eventOn)
  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: { code: departmentReference.code, name: departmentReference.name },
    assignmentType: input.assignmentType,
  })
}

function projectAssignmentAttributeChange(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "position_changed" | "manager_changed" }>,
): PersonnelActionSummary | CompanyOperationError {
  const current = assignmentAt(context, input.eventOn, input.departmentCode, input.assignmentType)

  if (current instanceof CompanyOperationError) {
    return current
  }

  const employment = employmentAt(context, input.eventOn)

  if (employment instanceof CompanyOperationError) {
    return employment
  }

  const departmentReference = department(context, input.departmentCode, false)

  if (departmentReference instanceof CompanyOperationError) {
    return departmentReference
  }

  const nextManagerId =
    input.kind === "manager_changed"
      ? employeeId(context, input.managerEmployeeCode)
      : current.managerEmployeeId

  if (nextManagerId instanceof CompanyOperationError) {
    return nextManagerId
  }

  closePeriod(context, "assignment", current, input.eventOn)
  addAssignment(context, {
    employment,
    startsOn: input.eventOn,
    departmentCode: current.departmentCode,
    assignmentType: current.assignmentType,
    positionTitle: input.kind === "position_changed" ? input.positionTitle : current.positionTitle,
    managerEmployeeId: nextManagerId,
  })

  if (input.kind === "position_changed") {
    return personnelActionSummarySchema.parse({
      kind: input.kind,
      eventOn: input.eventOn,
      department: { code: departmentReference.code, name: departmentReference.name },
      assignmentType: input.assignmentType,
      previousPositionTitle: current.positionTitle,
      positionTitle: input.positionTitle,
      changeType: input.changeType,
    })
  }

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: { code: departmentReference.code, name: departmentReference.name },
    assignmentType: input.assignmentType,
    previousManagerEmployeeCode: employeeCode(context, current.managerEmployeeId),
    managerEmployeeCode: input.managerEmployeeCode,
  })
}

function projectStatusChange(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "leave_started" | "returned" }>,
): PersonnelActionSummary | CompanyOperationError {
  const employment = employmentAt(context, input.eventOn)

  if (employment instanceof CompanyOperationError) {
    return employment
  }

  const current = context.schedule.statuses.find(
    (period) =>
      period.employeeId === context.command.employeeId && containsDate(period, input.eventOn),
  )
  const requiredStatus = input.kind === "leave_started" ? "active" : "leave"
  const nextStatus = input.kind === "leave_started" ? "leave" : "active"

  if (current === undefined || current.status !== requiredStatus) {
    return transitionError("現在の状態からこの発令へ遷移できません")
  }

  closePeriod(context, "status", current, input.eventOn)
  addStatus(context, employment, nextStatus, input.eventOn)
  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    status: nextStatus,
  })
}

function projectResponsibility(
  context: ProjectionContext,
  input: Extract<
    PersonnelActionInput,
    { kind: "department_responsibility_started" | "department_responsibility_ended" }
  >,
): PersonnelActionSummary | CompanyOperationError {
  const departmentReference = department(
    context,
    input.departmentCode,
    input.kind === "department_responsibility_started",
  )

  if (departmentReference instanceof CompanyOperationError) {
    return departmentReference
  }

  if (input.kind === "department_responsibility_started") {
    const employment = employmentAt(context, input.eventOn)

    if (employment instanceof CompanyOperationError) {
      return employment
    }

    const period: OrgResponsibilityPeriod = {
      periodId: newPeriodId(context, "responsibility"),
      revision: 1,
      departmentCode: input.departmentCode,
      responsibilityType: "department_manager",
      employeeId: context.command.employeeId,
      startsOn: input.eventOn,
      endsOn: employment.endsOn,
      isVoid: false,
      recordedByActionId: context.command.actionId,
      recordedAt: context.command.recordedAt,
    }
    recordMutation(context, { periodType: "responsibility", before: null, after: period })
  } else {
    const current = context.schedule.responsibilities.find(
      (period) =>
        period.employeeId === context.command.employeeId &&
        period.departmentCode === input.departmentCode &&
        containsDate(period, input.eventOn),
    )

    if (current === undefined) {
      return transitionError("対象日に有効な部署責任期間がありません")
    }

    closePeriod(context, "responsibility", current, input.eventOn)
  }

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: { code: departmentReference.code, name: departmentReference.name },
  })
}

function projectRetirement(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "retired" }>,
): PersonnelActionSummary | CompanyOperationError {
  const employment = employmentAt(context, input.retirementOn)

  if (employment instanceof CompanyOperationError) {
    return employment
  }

  const endsOn = nextCalendarDate(input.retirementOn)

  if (typeof endsOn !== "string") {
    return new CompanyValidationError("退職日が不正です", "personnel_action_invalid_transition", {
      cause: endsOn,
    })
  }

  closePeriod(context, "employment", employment, endsOn)

  for (const status of context.schedule.statuses) {
    if (
      status.employmentPeriodId === employment.periodId &&
      (status.endsOn === null || status.endsOn > endsOn)
    ) {
      closePeriod(context, "status", status, endsOn)
    }
  }

  for (const assignment of context.schedule.assignments) {
    if (
      assignment.employmentPeriodId === employment.periodId &&
      (assignment.endsOn === null || assignment.endsOn > endsOn)
    ) {
      closePeriod(context, "assignment", assignment, endsOn)
    }
  }

  for (const responsibility of context.schedule.responsibilities) {
    if (
      responsibility.employeeId === context.command.employeeId &&
      containsDate(responsibility, input.retirementOn)
    ) {
      closePeriod(context, "responsibility", responsibility, endsOn)
    }
  }

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.retirementOn,
    status: "retired",
  })
}

function reverseCorrectionMutations(context: ProjectionContext): CompanyOperationError | undefined {
  const correction = context.command.correction

  if (correction === undefined) {
    return transitionError("訂正対象の変更内容がありません")
  }

  if (correction.alreadyCorrected) {
    return new CompanyConflictError(
      "この発令は既に訂正されています",
      "personnel_action_already_corrected",
    )
  }

  for (const mutation of [...correction.mutations].reverse()) {
    const collection =
      mutation.periodType === "employment"
        ? context.schedule.employments
        : mutation.periodType === "status"
          ? context.schedule.statuses
          : mutation.periodType === "assignment"
            ? context.schedule.assignments
            : context.schedule.responsibilities
    const current = collection.find((period) => period.periodId === mutation.after.periodId)

    if (current === undefined) {
      continue
    }

    const after =
      mutation.before === null
        ? revisedPeriod(context, current, { isVoid: true })
        : revisedPeriod(context, current, {
            ...mutation.before,
            isVoid: false,
          })
    recordMutation(context, {
      periodType: mutation.periodType,
      before: current,
      after,
    } as LifecycleVersionMutation)
  }

  return undefined
}

function projectInitialState(
  context: ProjectionContext,
  input: Extract<PersonnelActionInput, { kind: "initial_state" }>,
): PersonnelActionSummary | CompanyOperationError {
  let snapshot: { code: string; name: string } | null = null

  if (input.initialStatus !== "retired") {
    const employment = addEmployment(context, input.eventOn)
    addStatus(context, employment, input.initialStatus, input.eventOn)

    if (input.departmentCode !== null) {
      const departmentReference = department(context, input.departmentCode, false)

      if (departmentReference instanceof CompanyOperationError) {
        return departmentReference
      }

      const managerId = employeeId(context, input.managerEmployeeCode)

      if (managerId instanceof CompanyOperationError) {
        return managerId
      }

      addAssignment(context, {
        employment,
        startsOn: input.eventOn,
        departmentCode: input.departmentCode,
        assignmentType: "primary",
        positionTitle: input.positionTitle,
        managerEmployeeId: managerId,
      })
      snapshot = { code: departmentReference.code, name: departmentReference.name }
    }
  }

  return personnelActionSummarySchema.parse({
    kind: input.kind,
    eventOn: input.eventOn,
    department: snapshot,
    positionTitle: input.positionTitle,
    managerEmployeeCode: input.managerEmployeeCode,
    status: input.initialStatus,
  })
}

function projectNonCorrection(
  context: ProjectionContext,
  input: Exclude<PersonnelActionInput, { kind: "corrected" }>,
): PersonnelActionSummary | CompanyOperationError {
  switch (input.kind) {
    case "hire":
    case "rehire":
      return projectHireOrRehire(context, input)
    case "primary_assignment_started":
    case "transferred":
    case "concurrent_assignment_started":
      return projectAssignmentStart(context, input)
    case "assignment_ended":
      return projectAssignmentEnd(context, input)
    case "position_changed":
    case "manager_changed":
      return projectAssignmentAttributeChange(context, input)
    case "department_responsibility_started":
    case "department_responsibility_ended":
      return projectResponsibility(context, input)
    case "leave_started":
    case "returned":
      return projectStatusChange(context, input)
    case "retired":
      return projectRetirement(context, input)
    case "initial_state":
      return projectInitialState(context, input)
  }
}

function organizationWithTarget(context: ProjectionContext): ReadonlyArray<LifecycleSchedule> {
  const otherSchedules = context.organizationSchedules.filter(
    (schedule) =>
      ![
        ...schedule.employments,
        ...schedule.statuses,
        ...schedule.assignments,
        ...schedule.responsibilities,
      ].some((period) => period.employeeId === context.command.employeeId),
  )

  return [...otherSchedules, context.schedule]
}

export function projectPersonnelAction(
  props: ProjectPersonnelActionProps,
): PersonnelActionProjection | CompanyOperationError {
  const parsed = personnelActionInputSchema.safeParse(props.command.input)

  if (!parsed.success) {
    return new CompanyValidationError(
      "人事発令の入力が不正です",
      "personnel_action_invalid_transition",
    )
  }

  const context: ProjectionContext = {
    ...props,
    command: { ...props.command, input: parsed.data },
    schedule: normalizeLifecycleSchedule(props.schedule),
    mutations: [],
    counters: { employment: 0, status: 0, assignment: 0, responsibility: 0 },
  }

  let summary: PersonnelActionSummary | CompanyOperationError

  if (parsed.data.kind === "corrected") {
    const correctionError = reverseCorrectionMutations(context)

    if (correctionError !== undefined) {
      return correctionError
    }

    const replacementSummary = projectNonCorrection(context, parsed.data.replacementAction)

    if (replacementSummary instanceof CompanyOperationError) {
      return replacementSummary
    }

    summary = personnelActionSummarySchema.parse({
      kind: "corrected",
      eventOn: parsed.data.eventOn,
      correctsActionId: parsed.data.correctsActionId,
      replacementKind: parsed.data.replacementAction.kind,
    })
  } else {
    summary = projectNonCorrection(context, parsed.data)
  }

  if (summary instanceof CompanyOperationError) {
    return summary
  }

  const validationError = validateLifecycleSchedules({
    schedules: organizationWithTarget(context),
    departments: props.departments.map((item) => item.code),
  })

  if (validationError !== undefined) {
    return validationError
  }

  return {
    schedule: context.schedule,
    mutations: context.mutations,
    summary,
    affectsOrganization: context.mutations.some(
      (mutation) =>
        mutation.periodType === "assignment" || mutation.periodType === "responsibility",
    ),
  }
}
