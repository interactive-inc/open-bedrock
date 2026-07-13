import type { WorkflowApproverSelector } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import { accounts, accountRoles, employees, orgDepartments, orgMemberships, roles } from "@/schema"
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm"
import { approvalDelegations } from "@/schema"

export type WorkflowApproverProvenance = {
  selector_index: number
  selector: WorkflowApproverSelector
  evidence: Readonly<Record<string, unknown>>
}

export type WorkflowApproverMatch = {
  employeeId: number
  accountId: number | null
  provenance: WorkflowApproverProvenance
}

export async function resolveWorkflowApproverMatches(props: {
  c: Context
  applicantEmployeeId: number
  selectors: ReadonlyArray<WorkflowApproverSelector>
}): Promise<ReadonlyArray<WorkflowApproverMatch> | Error> {
  try {
    const employeeRows = await props.c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const applicantCode = employeeRows.find(
      (employee) => employee.id === props.applicantEmployeeId,
    )?.code

    if (applicantCode === undefined) return []

    const idByCode = new Map(employeeRows.map((employee) => [employee.code, employee.id] as const))
    const result: Array<WorkflowApproverMatch> = []

    const [memberships, departments] = await Promise.all([
      props.c.var.database.select().from(orgMemberships),
      props.c.var.database.select().from(orgDepartments),
    ])

    const applicantMemberships = memberships.filter(
      (membership) => membership.employeeCode === applicantCode,
    )

    for (const [selectorIndex, selector] of props.selectors.entries()) {
      if (selector.type === "employee") {
        const id = idByCode.get(selector.employee_code)
        if (id !== undefined) {
          result.push({
            employeeId: id,
            accountId: null,
            provenance: {
              selector_index: selectorIndex,
              selector,
              evidence: { type: "employee_code", employee_code: selector.employee_code },
            },
          })
        }
        continue
      }

      if (selector.type === "role") {
        const rows = await props.c.var.database
          .select({
            accountId: accounts.id,
            employeeId: accounts.employeeId,
            roleId: roles.id,
          })
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

        for (const row of rows) {
          if (row.employeeId === null) continue
          result.push({
            employeeId: row.employeeId,
            accountId: row.accountId,
            provenance: {
              selector_index: selectorIndex,
              selector,
              evidence: {
                type: "account_role",
                account_id: row.accountId,
                role_id: row.roleId,
                role_key: selector.role_key,
              },
            },
          })
        }
        continue
      }

      if (selector.type === "direct_manager") {
        for (const membership of applicantMemberships) {
          const id =
            membership.managerEmployeeCode === null
              ? undefined
              : idByCode.get(membership.managerEmployeeCode)
          if (id !== undefined && membership.managerEmployeeCode !== null) {
            result.push({
              employeeId: id,
              accountId: null,
              provenance: {
                selector_index: selectorIndex,
                selector,
                evidence: {
                  type: "org_membership",
                  department_code: membership.departmentCode,
                  employee_code: applicantCode,
                  manager_employee_code: membership.managerEmployeeCode,
                },
              },
            })
          }
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
            if (id !== undefined) {
              result.push({
                employeeId: id,
                accountId: null,
                provenance: {
                  selector_index: selectorIndex,
                  selector,
                  evidence: {
                    type: "department_manager",
                    department_code: department.code,
                    manager_employee_code: department.managerEmployeeCode,
                  },
                },
              })
            }
          }
        }
        continue
      }

      const managersByEmployee = new Map<
        string,
        Array<{ departmentCode: string; managerEmployeeCode: string }>
      >()
      for (const membership of memberships) {
        if (membership.managerEmployeeCode === null) continue
        const managerEdges = managersByEmployee.get(membership.employeeCode) ?? []
        managerEdges.push({
          departmentCode: membership.departmentCode,
          managerEmployeeCode: membership.managerEmployeeCode,
        })
        managersByEmployee.set(membership.employeeCode, managerEdges)
      }

      const pending = (managersByEmployee.get(applicantCode) ?? []).map((edge) => ({
        code: edge.managerEmployeeCode,
        path: [
          {
            department_code: edge.departmentCode,
            employee_code: applicantCode,
            manager_employee_code: edge.managerEmployeeCode,
          },
        ],
      }))
      const visited = new Set<string>([applicantCode])
      while (pending.length > 0) {
        const current = pending.shift()
        if (current === undefined || visited.has(current.code)) continue
        visited.add(current.code)
        const id = idByCode.get(current.code)
        if (id !== undefined) {
          result.push({
            employeeId: id,
            accountId: null,
            provenance: {
              selector_index: selectorIndex,
              selector,
              evidence: { type: "management_chain", path: current.path },
            },
          })
        }
        pending.push(
          ...(managersByEmployee.get(current.code) ?? []).map((edge) => ({
            code: edge.managerEmployeeCode,
            path: [
              ...current.path,
              {
                department_code: edge.departmentCode,
                employee_code: current.code,
                manager_employee_code: edge.managerEmployeeCode,
              },
            ],
          })),
        )
      }
    }

    return result.filter((match) => match.employeeId !== props.applicantEmployeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve workflow approvers")
  }
}

export async function resolveRepresentedApprover(props: {
  c: Context
  actorEmployeeId: number
  actorAccountId: number
  candidateAccounts: ReadonlyArray<{ employeeId: number; accountId: number }>
  templateCode: string
  now: string
  allowDelegation: boolean
  excludedEmployeeIds?: ReadonlySet<number>
}): Promise<{ employeeId: number; delegationId: number | null } | null | Error> {
  const activeCandidateAccounts = await loadActiveCandidateAccounts(props)
  if (activeCandidateAccounts instanceof Error) return activeCandidateAccounts

  if (
    activeCandidateAccounts.some(
      (candidate) =>
        candidate.employeeId === props.actorEmployeeId &&
        candidate.accountId === props.actorAccountId &&
        props.excludedEmployeeIds?.has(candidate.employeeId) !== true,
    )
  ) {
    return { employeeId: props.actorEmployeeId, delegationId: null }
  }

  const candidateEmployeeIds = [
    ...new Set(activeCandidateAccounts.map((candidate) => candidate.employeeId)),
  ]

  if (props.allowDelegation === false || candidateEmployeeIds.length === 0) return null

  try {
    const delegations = await props.c.var.database
      .select({
        id: approvalDelegations.id,
        delegatorEmployeeId: approvalDelegations.delegatorEmployeeId,
      })
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.delegateEmployeeId, props.actorEmployeeId),
          inArray(approvalDelegations.delegatorEmployeeId, candidateEmployeeIds),
          lte(approvalDelegations.startsAt, props.now),
          gt(approvalDelegations.endsAt, props.now),
          isNull(approvalDelegations.cancelledAt),
          or(
            eq(approvalDelegations.templateCode, props.templateCode),
            isNull(approvalDelegations.templateCode),
          ),
        ),
      )
      .orderBy(asc(approvalDelegations.delegatorEmployeeId), asc(approvalDelegations.id))

    const delegation = delegations.find(
      (candidate) => props.excludedEmployeeIds?.has(candidate.delegatorEmployeeId) !== true,
    )

    return delegation === undefined
      ? null
      : { employeeId: delegation.delegatorEmployeeId, delegationId: delegation.id }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve approval delegation")
  }
}

async function loadActiveCandidateAccounts(props: {
  c: Context
  candidateAccounts: ReadonlyArray<{ employeeId: number; accountId: number }>
}): Promise<ReadonlyArray<{ employeeId: number; accountId: number }> | Error> {
  if (props.candidateAccounts.length === 0) return []

  try {
    const rows = await props.c.env.DB.prepare(
      `SELECT DISTINCT account.employee_id AS employee_id, account.id AS account_id
       FROM json_each(?1) candidate_json
       INNER JOIN accounts account
         ON account.id = json_extract(candidate_json.value, '$.accountId')
        AND account.employee_id = json_extract(candidate_json.value, '$.employeeId')
       INNER JOIN employees employee ON employee.id = account.employee_id
       WHERE account.status = 'active' AND employee.status <> 'retired'`,
    )
      .bind(JSON.stringify(props.candidateAccounts))
      .all<{ employee_id: number; account_id: number }>()

    return rows.results.map((row) => ({
      employeeId: row.employee_id,
      accountId: row.account_id,
    }))
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve active candidate accounts")
  }
}
