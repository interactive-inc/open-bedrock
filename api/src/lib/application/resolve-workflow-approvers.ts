import type { WorkflowApproverSelector } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import { accounts, accountRoles, employees, orgDepartments, orgMemberships, roles } from "@/schema"
import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm"
import { approvalDelegations } from "@/schema"

export async function resolveWorkflowApproverIds(props: {
  c: Context
  applicantEmployeeId: number
  selectors: ReadonlyArray<WorkflowApproverSelector>
}): Promise<ReadonlyArray<number> | Error> {
  try {
    const employeeRows = await props.c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const applicantCode = employeeRows.find(
      (employee) => employee.id === props.applicantEmployeeId,
    )?.code

    if (applicantCode === undefined) return []

    const idByCode = new Map(employeeRows.map((employee) => [employee.code, employee.id] as const))
    const result = new Set<number>()

    const [memberships, departments] = await Promise.all([
      props.c.var.database.select().from(orgMemberships),
      props.c.var.database.select().from(orgDepartments),
    ])

    const applicantMemberships = memberships.filter(
      (membership) => membership.employeeCode === applicantCode,
    )

    for (const selector of props.selectors) {
      if (selector.type === "employee") {
        const id = idByCode.get(selector.employee_code)
        if (id !== undefined) result.add(id)
        continue
      }

      if (selector.type === "role") {
        const rows = await props.c.var.database
          .select({ employeeId: accounts.employeeId })
          .from(accounts)
          .innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
          .innerJoin(roles, eq(roles.id, accountRoles.roleId))
          .where(
            and(
              eq(roles.key, selector.role_key),
              eq(accounts.status, "active"),
              isNotNull(accounts.employeeId),
            ),
          )

        for (const row of rows) if (row.employeeId !== null) result.add(row.employeeId)
        continue
      }

      if (selector.type === "direct_manager") {
        for (const membership of applicantMemberships) {
          const id =
            membership.managerEmployeeCode === null
              ? undefined
              : idByCode.get(membership.managerEmployeeCode)
          if (id !== undefined) result.add(id)
        }
        continue
      }

      if (selector.type === "department_manager") {
        const departmentCodes = new Set(
          applicantMemberships.map((membership) => membership.departmentCode),
        )
        for (const department of departments) {
          if (departmentCodes.has(department.code) && department.managerEmployeeCode !== null) {
            const id = idByCode.get(department.managerEmployeeCode)
            if (id !== undefined) result.add(id)
          }
        }
        continue
      }

      const managersByEmployee = new Map<string, Set<string>>()
      for (const membership of memberships) {
        if (membership.managerEmployeeCode === null) continue
        const managerCodes = managersByEmployee.get(membership.employeeCode) ?? new Set()
        managerCodes.add(membership.managerEmployeeCode)
        managersByEmployee.set(membership.employeeCode, managerCodes)
      }

      const pending = [...(managersByEmployee.get(applicantCode) ?? [])]
      const visited = new Set<string>([applicantCode])
      while (pending.length > 0) {
        const code = pending.shift()
        if (code === undefined || visited.has(code)) continue
        visited.add(code)
        const id = idByCode.get(code)
        if (id !== undefined) result.add(id)
        pending.push(...(managersByEmployee.get(code) ?? []))
      }
    }

    result.delete(props.applicantEmployeeId)
    return [...result]
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve workflow approvers")
  }
}

export async function resolveRepresentedApprover(props: {
  c: Context
  actorEmployeeId: number
  candidateEmployeeIds: ReadonlyArray<number>
  templateCode: string
  now: string
  allowDelegation: boolean
}): Promise<number | null | Error> {
  if (props.candidateEmployeeIds.includes(props.actorEmployeeId)) return props.actorEmployeeId
  if (props.allowDelegation === false || props.candidateEmployeeIds.length === 0) return null

  try {
    const delegation = await props.c.var.database
      .select({ delegatorEmployeeId: approvalDelegations.delegatorEmployeeId })
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.delegateEmployeeId, props.actorEmployeeId),
          inArray(approvalDelegations.delegatorEmployeeId, [...props.candidateEmployeeIds]),
          lte(approvalDelegations.startsAt, props.now),
          gte(approvalDelegations.endsAt, props.now),
          or(
            eq(approvalDelegations.templateCode, props.templateCode),
            isNull(approvalDelegations.templateCode),
          ),
        ),
      )
      .limit(1)
      .then((rows) => rows.at(0))

    return delegation?.delegatorEmployeeId ?? null
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve approval delegation")
  }
}
