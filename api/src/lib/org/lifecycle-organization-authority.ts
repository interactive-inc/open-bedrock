import type { Context } from "@/env"
import {
  EmployeeLifecycleReadRepository,
  type EmployeeLifecycleState,
} from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { ApplicationError, ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/company-business-date"
import type { OrganizationAuthority } from "@/lib/org/organization-authority"

const MAX_MANAGEMENT_DEPTH = 64

const noAuthority: OrganizationAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}

async function resolveAsOf(c: Context, asOf?: string): Promise<string | ApplicationError> {
  if (asOf !== undefined) {
    return isoDate.safeParse(asOf).success
      ? asOf
      : new ValidationError("as_of が不正です", "personnel_action_invalid_transition")
  }

  const resolved = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  return typeof resolved === "string"
    ? resolved
    : new UnexpectedError("会社営業日を解決できません", { cause: resolved })
}

type OrganizationGraph = {
  states: ReadonlyMap<number, EmployeeLifecycleState>
  managersByEmployee: ReadonlyMap<number, ReadonlySet<number>>
  activeDepartmentCodes: ReadonlySet<string>
}

function validateGraph(
  managersByEmployee: ReadonlyMap<number, ReadonlySet<number>>,
): ApplicationError | undefined {
  const visiting = new Set<number>()
  const visited = new Set<number>()

  const visit = (employeeId: number, depth: number): boolean => {
    if (depth > MAX_MANAGEMENT_DEPTH || visiting.has(employeeId)) return true
    if (visited.has(employeeId)) return false
    visiting.add(employeeId)
    for (const managerId of managersByEmployee.get(employeeId) ?? []) {
      if (visit(managerId, depth + 1)) return true
    }
    visiting.delete(employeeId)
    visited.add(employeeId)
    return false
  }

  for (const employeeId of managersByEmployee.keys()) {
    if (visit(employeeId, 0)) {
      return new ConflictError("上司関係を安全に解決できません", "manager_cycle")
    }
  }
  return undefined
}

async function loadGraph(c: Context, asOf: string): Promise<OrganizationGraph | ApplicationError> {
  try {
    const [employeeRows, departmentRows] = await Promise.all([
      c.env.DB.prepare("SELECT id FROM employees ORDER BY id").all<{ id: number }>(),
      c.env.DB.prepare(
        "SELECT code FROM org_departments WHERE archived_at IS NULL ORDER BY code",
      ).all<{ code: string }>(),
    ])
    const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
      employeeRows.results.map((row) => row.id),
      asOf,
    )
    if (states instanceof ApplicationError) return states
    const activeDepartmentCodes = new Set(departmentRows.results.map((row) => row.code))
    const managersByEmployee = new Map<number, Set<number>>()

    for (const state of states.values()) {
      if (state.archived || (state.status !== "active" && state.status !== "leave")) continue
      const managers = new Set<number>()
      for (const assignment of [
        ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
        ...state.concurrentAssignments,
      ]) {
        if (
          activeDepartmentCodes.has(assignment.departmentCode) &&
          assignment.managerEmployeeId !== null
        ) {
          managers.add(assignment.managerEmployeeId)
        }
      }
      managersByEmployee.set(state.employeeId, managers)
    }

    const graphError = validateGraph(managersByEmployee)
    return graphError ?? { states, managersByEmployee, activeDepartmentCodes }
  } catch (cause) {
    return new UnexpectedError("組織上の権限を解決できません", { cause })
  }
}

function inManagementChain(
  graph: OrganizationGraph,
  actorEmployeeId: number,
  targetEmployeeId: number,
): boolean {
  const pending = [...(graph.managersByEmployee.get(targetEmployeeId) ?? [])]
  const visited = new Set<number>([targetEmployeeId])

  while (pending.length > 0) {
    const managerId = pending.shift()
    if (managerId === undefined || visited.has(managerId)) continue
    if (managerId === actorEmployeeId) return true
    visited.add(managerId)
    pending.push(...(graph.managersByEmployee.get(managerId) ?? []))
  }
  return false
}

function authorityFromGraph(
  graph: OrganizationGraph,
  actorEmployeeId: number,
  targetEmployeeId: number,
): OrganizationAuthority {
  if (actorEmployeeId === targetEmployeeId) return noAuthority
  const actor = graph.states.get(actorEmployeeId)
  const target = graph.states.get(targetEmployeeId)
  if (
    actor === undefined ||
    target === undefined ||
    actor.archived ||
    target.archived ||
    (actor.status !== "active" && actor.status !== "leave") ||
    (target.status !== "active" && target.status !== "leave")
  ) {
    return noAuthority
  }
  const directManager =
    graph.managersByEmployee.get(targetEmployeeId)?.has(actorEmployeeId) ?? false
  const targetDepartments = new Set(
    [
      ...(target.primaryAssignment === null ? [] : [target.primaryAssignment]),
      ...target.concurrentAssignments,
    ]
      .map((assignment) => assignment.departmentCode)
      .filter((code) => graph.activeDepartmentCodes.has(code)),
  )
  const departmentManager = actor.responsibilityDepartmentCodes.some(
    (code) => graph.activeDepartmentCodes.has(code) && targetDepartments.has(code),
  )
  return {
    directManager,
    departmentManager,
    managementChain: inManagementChain(graph, actorEmployeeId, targetEmployeeId),
  }
}

export async function resolveLifecycleOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
  asOf?: string,
): Promise<OrganizationAuthority | ApplicationError> {
  const date = await resolveAsOf(c, asOf)
  if (date instanceof ApplicationError) return date
  const graph = await loadGraph(c, date)
  if (graph instanceof ApplicationError) return graph
  return authorityFromGraph(graph, actorEmployeeId, targetEmployeeId)
}

export async function listLifecycleManagedEmployeeIds(
  c: Context,
  actorEmployeeId: number,
  asOf?: string,
): Promise<ReadonlyArray<number> | ApplicationError> {
  const date = await resolveAsOf(c, asOf)
  if (date instanceof ApplicationError) return date
  const graph = await loadGraph(c, date)
  if (graph instanceof ApplicationError) return graph
  return [...graph.states.keys()]
    .filter((employeeId) => employeeId !== actorEmployeeId)
    .filter((employeeId) => {
      const authority = authorityFromGraph(graph, actorEmployeeId, employeeId)
      return authority.managementChain || authority.departmentManager
    })
    .sort((left, right) => left - right)
}
