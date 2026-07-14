import type { WorkflowApproverSelector } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/company-business-date"
import { accounts, accountRoles, employees, orgDepartments, orgMemberships, roles } from "@/schema"
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm"
import { approvalDelegations } from "@/schema"
import { filterLiveWorkflowAccounts } from "@/lib/application/filter-live-workflow-accounts"

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

type OrganizationMembership = {
  employeeCode: string
  departmentCode: string
  managerEmployeeCode: string | null
  evidence: Readonly<Record<string, unknown>>
}

type DepartmentManager = {
  code: string
  managerEmployeeCode: string
  evidence: Readonly<Record<string, unknown>>
}

async function loadWorkflowOrganization(props: {
  c: Context
  employeeRows: ReadonlyArray<{ id: number; code: string }>
}): Promise<
  | {
      memberships: ReadonlyArray<OrganizationMembership>
      departments: ReadonlyArray<DepartmentManager>
    }
  | Error
> {
  const migrationStatus = await new EmployeeLifecycleRepository(props.c).migrationStatus()
  if (migrationStatus instanceof ApplicationError) return migrationStatus

  if (migrationStatus !== "verified") {
    const [memberships, departments] = await Promise.all([
      props.c.var.database.select().from(orgMemberships),
      props.c.var.database.select().from(orgDepartments),
    ])
    return {
      memberships: memberships.map((membership) => ({
        employeeCode: membership.employeeCode,
        departmentCode: membership.departmentCode,
        managerEmployeeCode: membership.managerEmployeeCode,
        evidence: {
          type: "org_membership",
          department_code: membership.departmentCode,
          employee_code: membership.employeeCode,
          manager_employee_code: membership.managerEmployeeCode,
        },
      })),
      departments: departments.flatMap((department) =>
        department.managerEmployeeCode === null
          ? []
          : [
              {
                code: department.code,
                managerEmployeeCode: department.managerEmployeeCode,
                evidence: {
                  type: "department_manager",
                  department_code: department.code,
                  manager_employee_code: department.managerEmployeeCode,
                },
              },
            ],
      ),
    }
  }

  const businessDate = resolveCompanyBusinessDate({
    now: props.c.env.NOW ?? new Date().toISOString(),
    timeZone: props.c.env.COMPANY_TIME_ZONE,
  })
  if (typeof businessDate !== "string") return businessDate
  const states = await new EmployeeLifecycleReadRepository(props.c).findStatesAt(
    props.employeeRows.map((employee) => employee.id),
    businessDate,
  )
  if (states instanceof ApplicationError) return states
  const activeDepartmentRows = await props.c.var.database
    .select({ code: orgDepartments.code })
    .from(orgDepartments)
    .where(isNull(orgDepartments.archivedAt))
  const activeDepartments = new Set(activeDepartmentRows.map((department) => department.code))
  const activeStates = [...states.values()].filter(
    (state) => !state.archived && (state.status === "active" || state.status === "leave"),
  )
  const activeCodes = new Set(activeStates.map((state) => state.employeeCode))

  return {
    memberships: activeStates.flatMap((state) =>
      [
        ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
        ...state.concurrentAssignments,
      ]
        .filter((assignment) => activeDepartments.has(assignment.departmentCode))
        .map((assignment) => ({
          employeeCode: state.employeeCode,
          departmentCode: assignment.departmentCode,
          managerEmployeeCode:
            assignment.managerEmployeeCode !== null &&
            activeCodes.has(assignment.managerEmployeeCode)
              ? assignment.managerEmployeeCode
              : null,
          evidence: {
            type: "lifecycle_assignment",
            assignment_period_id: assignment.periodId,
            department_code: assignment.departmentCode,
            employee_code: state.employeeCode,
            manager_employee_code: assignment.managerEmployeeCode,
            as_of: businessDate,
          },
        })),
    ),
    departments: activeStates.flatMap((state) =>
      state.responsibilityDepartmentCodes
        .filter((code) => activeDepartments.has(code))
        .map((code) => ({
          code,
          managerEmployeeCode: state.employeeCode,
          evidence: {
            type: "lifecycle_responsibility",
            department_code: code,
            manager_employee_code: state.employeeCode,
            as_of: businessDate,
          },
        })),
    ),
  }
}

export async function resolveWorkflowApproverMatches(props: {
  c: Context
  applicantEmployeeId: number | null
  selectors: ReadonlyArray<WorkflowApproverSelector>
  targetDepartmentCode?: string | null
}): Promise<ReadonlyArray<WorkflowApproverMatch> | Error> {
  try {
    const employeeRows = await props.c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const applicantCode = employeeRows.find(
      (employee) => employee.id === props.applicantEmployeeId,
    )?.code

    const idByCode = new Map(employeeRows.map((employee) => [employee.code, employee.id] as const))
    const result: Array<WorkflowApproverMatch> = []

    const organization = await loadWorkflowOrganization({ c: props.c, employeeRows })
    if (organization instanceof Error) return organization
    const { memberships, departments } = organization

    const applicantMemberships =
      applicantCode === undefined
        ? []
        : memberships.filter((membership) => membership.employeeCode === applicantCode)

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
                evidence: membership.evidence,
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
                  evidence: department.evidence,
                },
              })
            }
          }
        }
        continue
      }

      if (selector.type === "target_department_manager") {
        for (const department of departments) {
          if (
            department.code === props.targetDepartmentCode &&
            department.managerEmployeeCode !== null
          ) {
            const id = idByCode.get(department.managerEmployeeCode)
            if (id !== undefined) {
              result.push({
                employeeId: id,
                accountId: null,
                provenance: {
                  selector_index: selectorIndex,
                  selector,
                  evidence: department.evidence,
                },
              })
            }
          }
        }
        continue
      }

      const managersByEmployee = new Map<
        string,
        Array<{
          departmentCode: string
          managerEmployeeCode: string
          evidence: Readonly<Record<string, unknown>>
        }>
      >()
      for (const membership of memberships) {
        if (membership.managerEmployeeCode === null) continue
        const managerEdges = managersByEmployee.get(membership.employeeCode) ?? []
        managerEdges.push({
          departmentCode: membership.departmentCode,
          managerEmployeeCode: membership.managerEmployeeCode,
          evidence: membership.evidence,
        })
        managersByEmployee.set(membership.employeeCode, managerEdges)
      }

      const pending = (
        applicantCode === undefined ? [] : (managersByEmployee.get(applicantCode) ?? [])
      ).map((edge) => ({
        code: edge.managerEmployeeCode,
        path: [edge.evidence],
      }))
      const visited = new Set<string>(applicantCode === undefined ? [] : [applicantCode])
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
            path: [...current.path, edge.evidence],
          })),
        )
      }
    }

    return result.filter(
      (match) =>
        props.applicantEmployeeId === null || match.employeeId !== props.applicantEmployeeId,
    )
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
  return filterLiveWorkflowAccounts(props.c, props.candidateAccounts)
}
