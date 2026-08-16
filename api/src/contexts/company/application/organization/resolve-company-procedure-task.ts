import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"
import { applicableWorkflowSteps } from "@/contexts/company/application/organization/company-procedure-applicable-steps"
import { resolveWorkflowStepSnapshot } from "@/contexts/company/application/organization/resolve-company-procedure-task-snapshot"
import type { CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/organization/company-procedure-workflow"
import {
  accountRoles,
  accounts,
  permissions,
  rolePermissions,
  roles,
} from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import type { Context } from "@/env"
import type { StartSystemProcedureTask } from "@system/application/workflow/start-system-procedure"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"
import { toSystemProposalDigest } from "@system/domain/workflow/to-system-proposal-digest"
import type { AccountId } from "@system/domain/auth/account-id"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"

export type CompanyProcedureApplicant = Readonly<{
  id: number
  code: string | null
  dept_id: number | null
  dept_name: string | null
  position: string | null
  status: string
}>

export type ResolvedCompanyProcedureTask = Readonly<{
  key: string
  name: string
  rejectionBehavior: "reject" | "return"
  allowDelegation: boolean
  task: StartSystemProcedureTask
}>

/** Company policyを評価し、Systemへ渡せるAccount候補とopaque資格証拠だけを返す。 */
export async function resolveCompanyProcedureTask(
  input: Readonly<{
    c: Context
    policy: CompanyProcedureDecisionPolicy
    payload: unknown
    applicant: CompanyProcedureApplicant
    activatedAt: Date
    afterTaskKey: string | null
    authoritySubjectEmployeeId?: number | null
    targetDepartmentCode?: string | null
    excludedEmployeeIds?: ReadonlySet<number>
  }>,
): Promise<ResolvedCompanyProcedureTask | null | Error> {
  if (input.policy.workflow === null) {
    if (input.afterTaskKey !== null) return null
    return resolveLegacyTask(input)
  }

  const steps = applicableWorkflowSteps({
    workflow: input.policy.workflow,
    payload: input.payload,
    applicant: input.applicant,
  })
  const previousIndex =
    input.afterTaskKey === null ? null : steps.findIndex((step) => step.key === input.afterTaskKey)
  if (previousIndex === -1) return new Error("current Company procedure task is unknown")
  const index = previousIndex === null ? 0 : previousIndex + 1
  if (index >= steps.length) return null
  const step = steps[index]
  if (step === undefined) return null

  return resolveConfiguredTask(input, step)
}

async function resolveConfiguredTask(
  input: Parameters<typeof resolveCompanyProcedureTask>[0],
  step: ApplicationWorkflowStep,
): Promise<ResolvedCompanyProcedureTask | Error> {
  const activatedAt = input.activatedAt.toISOString()
  const snapshot = await resolveWorkflowStepSnapshot({
    c: input.c,
    applicantEmployeeId:
      input.authoritySubjectEmployeeId === undefined
        ? input.applicant.id
        : input.authoritySubjectEmployeeId,
    step,
    activatedAt,
    excludedEmployeeIds: input.excludedEmployeeIds,
    targetDepartmentCode: input.targetDepartmentCode ?? null,
  })
  if (snapshot instanceof Error) return snapshot
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const candidate of snapshot.candidates) {
    const evidence = toCanonicalSystemJson(JSON.parse(candidate.selectorsJson))
    if (evidence instanceof Error) return evidence
    const digest = await toSystemProposalDigest(evidence)
    if (digest instanceof Error) return digest
    candidates.push({
      accountId: candidate.accountId,
      source: candidate.source,
      evidenceContext: "company",
      evidenceKind: "organizational-authority",
      evidenceId: snapshot.resolutionId,
      evidenceVersion: candidate.resolvedAt,
      eligibilityDigest: digest,
      eligibleFrom: candidate.eligibleFrom === null ? null : new Date(candidate.eligibleFrom),
      resolvedAt: new Date(candidate.resolvedAt),
    })
  }

  return {
    key: step.key,
    name: step.name,
    rejectionBehavior: step.rejection_behavior,
    allowDelegation: step.allow_delegation,
    task: {
      key: step.key,
      requiredApprovals: snapshot.requiredApprovals,
      openedAt: new Date(snapshot.activatedAt),
      dueAt: snapshot.dueAt === null ? null : new Date(snapshot.dueAt),
      candidates,
      excludedAccountIds: [],
    },
  }
}

async function resolveLegacyTask(
  input: Parameters<typeof resolveCompanyProcedureTask>[0],
): Promise<ResolvedCompanyProcedureTask | Error> {
  const roleKeys = input.policy.approverRoles
  const roleCondition = roleKeys.length === 0 ? undefined : inArray(roles.key, [...roleKeys])
  const rows = await input.c.var.database
    .select({
      accountId: systemAccounts.id,
      employeeId: accountEmployeeLinks.employeeId,
      roleKey: roles.key,
    })
    .from(accounts)
    .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
    .innerJoin(employees, eq(employees.id, accountEmployeeLinks.employeeId))
    .innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
    .innerJoin(roles, eq(roles.id, accountRoles.roleId))
    .innerJoin(systemAccounts, sql`${systemAccounts.id} = CAST(${accounts.id} AS TEXT)`)
    .where(
      and(
        eq(accounts.status, "active"),
        eq(systemAccounts.status, "active"),
        eq(employees.status, "active"),
        isNull(employees.archivedAt),
        roleCondition,
        sql`EXISTS (
          SELECT 1
          FROM account_roles permission_account_role
          JOIN role_permissions permission_role
            ON permission_role.role_id = permission_account_role.role_id
          JOIN permissions permission
            ON permission.id = permission_role.permission_id
          WHERE permission_account_role.account_id = ${accounts.id}
            AND permission.key = 'application:approve'
        )`,
      ),
    )
  const grouped = new Map<AccountId, { employeeId: number; roleKeys: Set<string> }>()
  for (const row of rows) {
    if (row.employeeId === input.applicant.id) continue
    const existing = grouped.get(row.accountId) ?? {
      employeeId: row.employeeId,
      roleKeys: new Set<string>(),
    }
    existing.roleKeys.add(row.roleKey)
    grouped.set(row.accountId, existing)
  }
  const resolutionId = crypto.randomUUID()
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const [accountId, candidate] of grouped) {
    const hasOrganizationWideAuthority = await hasPermission(
      input.c,
      candidate.employeeId,
      "org:manage",
    )
    if (hasOrganizationWideAuthority instanceof Error) return hasOrganizationWideAuthority
    const authority = hasOrganizationWideAuthority
      ? { managementChain: true, departmentManager: true }
      : await resolveOrganizationAuthority(input.c, candidate.employeeId, input.applicant.id)
    if (authority instanceof Error) return authority
    if (!authority.managementChain && !authority.departmentManager) continue
    const canonicalEvidence = toCanonicalSystemJson({
      accountId,
      employeeId: candidate.employeeId,
      roleKeys: [...candidate.roleKeys].toSorted(),
      permission: "application:approve",
      organizationAuthority: authority,
      resolvedAt: input.activatedAt.toISOString(),
    })
    if (canonicalEvidence instanceof Error) return canonicalEvidence
    const digest = await toSystemProposalDigest(canonicalEvidence)
    if (digest instanceof Error) return digest
    candidates.push({
      accountId,
      source: "primary",
      evidenceContext: "company",
      evidenceKind: "legacy-organizational-authority",
      evidenceId: resolutionId,
      evidenceVersion: input.activatedAt.toISOString(),
      eligibilityDigest: digest,
      eligibleFrom: null,
      resolvedAt: input.activatedAt,
    })
  }
  if (candidates.length === 0) {
    return new Error("legacy procedure has no eligible Company decision candidate")
  }

  return {
    key: "manager_approval",
    name: "承認",
    rejectionBehavior: "reject",
    allowDelegation: true,
    task: {
      key: "manager_approval",
      requiredApprovals: 1,
      openedAt: input.activatedAt,
      dueAt: null,
      candidates,
      excludedAccountIds: [],
    },
  }
}

async function hasPermission(
  c: Context,
  employeeId: number,
  permissionKey: string,
): Promise<boolean | Error> {
  try {
    const found = await c.var.database
      .select({ id: permissions.id })
      .from(accountEmployeeLinks)
      .innerJoin(accountRoles, eq(accountRoles.accountId, accountEmployeeLinks.accountId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, accountRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(eq(accountEmployeeLinks.employeeId, employeeId), eq(permissions.key, permissionKey)),
      )
      .limit(1)

    return found.length > 0
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("failed to resolve Company permission", { cause })
  }
}
