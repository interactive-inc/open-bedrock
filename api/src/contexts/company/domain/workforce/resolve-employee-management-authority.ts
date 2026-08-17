import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export type EmployeeManagementAuthority = Readonly<{
  directManager: boolean
  departmentManager: boolean
  managementChain: boolean
}>

const noAuthority: EmployeeManagementAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}

function isEligible(state: WorkforceStateAt | undefined): state is WorkforceStateAt {
  return (
    state !== undefined &&
    state.employmentId !== null &&
    (state.status === "ACTIVE" || state.status === "ON_LEAVE")
  )
}

function assignments(state: WorkforceStateAt): ReadonlyArray<OrgAssignmentPeriod> {
  return [
    ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
    ...state.concurrentAssignments,
  ]
}

function isInManagementChain(props: {
  states: ReadonlyMap<EmployeeId, WorkforceStateAt>
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): boolean {
  const target = props.states.get(props.targetEmployeeId)
  if (!isEligible(target)) return false

  const pending = assignments(target).flatMap((assignment) =>
    assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
  )
  const visited = new Set<EmployeeId>([props.targetEmployeeId])

  while (pending.length > 0) {
    const managerEmployeeId = pending.shift()
    if (managerEmployeeId === undefined || visited.has(managerEmployeeId)) continue
    if (managerEmployeeId === props.actorEmployeeId) return true

    visited.add(managerEmployeeId)
    const manager = props.states.get(managerEmployeeId)
    if (!isEligible(manager)) continue
    pending.push(
      ...assignments(manager).flatMap((assignment) =>
        assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
      ),
    )
  }

  return false
}

/** 検証済みCompany snapshotだけから、actorの対象Employeeに対する管理範囲を解決する。 */
export function resolveEmployeeManagementAuthority(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): EmployeeManagementAuthority {
  if (props.actorEmployeeId === props.targetEmployeeId) return noAuthority

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const actor = states.get(props.actorEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligible(actor) || !isEligible(target)) return noAuthority

  const targetAssignments = assignments(target)
  const directManager = targetAssignments.some(
    (assignment) => assignment.managerEmployeeId === props.actorEmployeeId,
  )
  const targetOrganizationUnitIds = new Set(
    targetAssignments.map((assignment) => assignment.organizationUnitId),
  )
  const departmentManager = actor.responsibilities.some(
    (responsibility) =>
      responsibility.responsibilityType === "MANAGER" &&
      targetOrganizationUnitIds.has(responsibility.organizationUnitId),
  )

  return {
    directManager,
    departmentManager,
    managementChain: isInManagementChain({
      states,
      actorEmployeeId: props.actorEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
  }
}

/** 検証済みCompany snapshotだけから、actorが管理できるEmployee IDを決定的に返す。 */
export function listManagedWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter((employeeId) => {
      const authority = resolveEmployeeManagementAuthority({
        states: props.states,
        actorEmployeeId: props.actorEmployeeId,
        targetEmployeeId: employeeId,
      })
      return authority.managementChain || authority.departmentManager
    })
    .toSorted()
}

/** 管理ラインだけを対象に、actorの配下Employee IDを返す。 */
export function listReportWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter(
      (employeeId) =>
        resolveEmployeeManagementAuthority({
          states: props.states,
          actorEmployeeId: props.actorEmployeeId,
          targetEmployeeId: employeeId,
        }).managementChain,
    )
    .toSorted()
}

/** 検証済みsnapshotから、閲覧者と対象者のApp互換関係を解決する。 */
export function resolveWorkforceEmployeeRelation(props: {
  states: ReadonlyArray<WorkforceStateAt>
  viewerEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): Readonly<{ isSelf: boolean; isReport: boolean; isSameDepartment: boolean }> {
  if (props.viewerEmployeeId === props.targetEmployeeId) {
    return { isSelf: true, isReport: false, isSameDepartment: false }
  }

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const viewer = states.get(props.viewerEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligible(viewer) || !isEligible(target)) {
    return { isSelf: false, isReport: false, isSameDepartment: false }
  }

  const viewerOrganizationUnitIds = new Set(
    assignments(viewer).map((assignment) => assignment.organizationUnitId),
  )
  const isSameDepartment = assignments(target).some((assignment) =>
    viewerOrganizationUnitIds.has(assignment.organizationUnitId),
  )

  return {
    isSelf: false,
    isReport: isInManagementChain({
      states,
      actorEmployeeId: props.viewerEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
    isSameDepartment,
  }
}
