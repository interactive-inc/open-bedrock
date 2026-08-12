import type { Context } from "@/env"
import {
  EmployeeLifecycleReadRepository,
  type EmployeeLifecycleState,
} from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { ApplicationError, ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import type { OrganizationAuthority } from "@/contexts/company/domain/organization/organization-authority"

const MAX_MANAGEMENT_DEPTH = 64

const noAuthority: OrganizationAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}

type Props = {
  states: ReadonlyMap<number, EmployeeLifecycleState>
  managersByEmployee: ReadonlyMap<number, ReadonlySet<number>>
  activeDepartmentCodes: ReadonlySet<string>
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

/**
 * 指定営業日時点の組織図（在籍状態・上司関係・有効部門）を保持する値オブジェクト。
 * IAM permission は「操作能力」、本クラスは「対象範囲」だけを扱う。
 */
export class LifecycleOrganizationGraph {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  /** as_of（未指定なら会社営業日）時点のグラフを読み込む。循環検出時は ConflictError。 */
  static async load(
    c: Context,
    asOf?: string,
  ): Promise<LifecycleOrganizationGraph | ApplicationError> {
    const date = await resolveAsOf(c, asOf)
    if (date instanceof ApplicationError) return date

    try {
      const [employeeRows, departmentRows] = await Promise.all([
        c.env.DB.prepare("SELECT id FROM employees ORDER BY id").all<{ id: number }>(),
        c.env.DB.prepare(
          "SELECT code FROM org_departments WHERE archived_at IS NULL ORDER BY code",
        ).all<{ code: string }>(),
      ])
      const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
        employeeRows.results.map((row) => row.id),
        date,
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
      return (
        graphError ??
        new LifecycleOrganizationGraph({ states, managersByEmployee, activeDepartmentCodes })
      )
    } catch (cause) {
      return new UnexpectedError("組織上の権限を解決できません", { cause })
    }
  }

  /** actor が target に対して持つ管理関係を返す。 */
  authorityFor(actorEmployeeId: number, targetEmployeeId: number): OrganizationAuthority {
    if (actorEmployeeId === targetEmployeeId) return noAuthority
    const actor = this.props.states.get(actorEmployeeId)
    const target = this.props.states.get(targetEmployeeId)
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
      this.props.managersByEmployee.get(targetEmployeeId)?.has(actorEmployeeId) ?? false
    const targetDepartments = new Set(
      [
        ...(target.primaryAssignment === null ? [] : [target.primaryAssignment]),
        ...target.concurrentAssignments,
      ]
        .map((assignment) => assignment.departmentCode)
        .filter((code) => this.props.activeDepartmentCodes.has(code)),
    )
    const departmentManager = actor.responsibilityDepartmentCodes.some(
      (code) => this.props.activeDepartmentCodes.has(code) && targetDepartments.has(code),
    )
    return {
      directManager,
      departmentManager,
      managementChain: this.inManagementChain(actorEmployeeId, targetEmployeeId),
    }
  }

  /** actor が管理できる社員IDを昇順で返す。 */
  managedEmployeeIds(actorEmployeeId: number): ReadonlyArray<number> {
    return [...this.props.states.keys()]
      .filter((employeeId) => employeeId !== actorEmployeeId)
      .filter((employeeId) => {
        const authority = this.authorityFor(actorEmployeeId, employeeId)
        return authority.managementChain || authority.departmentManager
      })
      .sort((left, right) => left - right)
  }

  private inManagementChain(actorEmployeeId: number, targetEmployeeId: number): boolean {
    const pending = [...(this.props.managersByEmployee.get(targetEmployeeId) ?? [])]
    const visited = new Set<number>([targetEmployeeId])

    while (pending.length > 0) {
      const managerId = pending.shift()
      if (managerId === undefined || visited.has(managerId)) continue
      if (managerId === actorEmployeeId) return true
      visited.add(managerId)
      pending.push(...(this.props.managersByEmployee.get(managerId) ?? []))
    }
    return false
  }
}
