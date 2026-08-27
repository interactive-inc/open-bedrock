import { resolveGovernanceOrgRole } from "@/contexts/governance/infrastructure/adapters/resolve-governance-org-role.adapter"
import { GovernanceAdapter } from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { PERMISSION_KEYS } from "@/api/http/permissions/permission-key.catalog"
import { loadCurrentOrganization } from "@/contexts/company/infrastructure/organization/current-organization-read-model.repository"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { governanceDocuments } from "@/contexts/governance/infrastructure/schema/governance"
import {
  findAuthorityRuleOverlaps,
  governanceImpactIssue as issue,
  type GovernanceImpactIssue,
  type GovernanceImpactReport,
} from "@/contexts/governance/domain/policies/governance-impact.policy"
import type { GovernanceReferenceCatalog } from "@/contexts/governance/application/sync-governance-markdown"
import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"

/** Governanceのimpact read modelをHTTP composition境界へ公開する。 */
export async function readGovernanceImpact(
  c: Context,
  session: Session,
  referenceCatalog: GovernanceReferenceCatalog = {},
): Promise<GovernanceImpactReport | Error> {
  if (!session.permissions.has("governance:manage")) {
    return new ForbiddenError(
      "規程の影響検査を実行する権限がありません",
      "governance_impact_forbidden",
    )
  }
  const repository = new GovernanceAdapter(c)
  const [records, roles, capabilities, organization, employeeRows, documents] = await Promise.all([
    repository.listDocuments(true),
    repository.listOrgRoles(),
    repository.listCapabilities(),
    loadCurrentOrganization(c),
    c.var.database.select({ name: employees.name }).from(employees),
    c.var.database
      .select({ code: governanceDocuments.code, kind: governanceDocuments.kind })
      .from(governanceDocuments),
  ])
  const failure = [records, roles, capabilities, organization].find(
    (result) => result instanceof Error,
  )
  if (failure instanceof Error) {
    return new UnexpectedError("規程の影響検査に必要な状態を取得できません", { cause: failure })
  }
  if (
    records instanceof Error ||
    roles instanceof Error ||
    capabilities instanceof Error ||
    organization instanceof Error
  ) {
    return new UnexpectedError("規程の影響検査に必要な状態を取得できません")
  }

  const businessDate = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (businessDate instanceof Error) {
    return new UnexpectedError("会社営業日を解決できません", { cause: businessDate })
  }
  const issues: Array<GovernanceImpactIssue> = []
  const known = {
    capability: new Set(capabilities.map((item) => item.code)),
    org_role: new Set(roles.map((item) => item.code)),
    permission: new Set<string>(PERMISSION_KEYS),
    training: referenceCatalog.training ?? new Set<string>(),
    policy: new Set(documents.filter((item) => item.kind === "policy").map((item) => item.code)),
    procedure: new Set(
      documents.filter((item) => item.kind === "procedure").map((item) => item.code),
    ),
    guideline: new Set(
      documents.filter((item) => item.kind === "guideline").map((item) => item.code),
    ),
    control: new Set(documents.filter((item) => item.kind === "control").map((item) => item.code)),
  }
  const roleCache = new Map<string, Awaited<ReturnType<typeof resolveGovernanceOrgRole>>>()
  const resolveRole = async (code: string) => {
    const cached = roleCache.get(code)
    if (cached !== undefined) return cached
    const resolved = await resolveGovernanceOrgRole({ c: c, code })
    roleCache.set(code, resolved)
    return resolved
  }

  const currentNames = employeeRows
    .map((item) => item.name.trim())
    .filter((name) => name.length >= 3)
  const departmentNames = organization.departments
    .map((item) => item.name.trim())
    .filter((name) => name.length >= 3)

  for (const record of records) {
    const version = record.version
    if (version === null) {
      issues.push(issue("error", "missing_version", record.row.code, "文書版がありません", null))
      continue
    }
    if (version.metadata.id !== record.row.code) {
      issues.push(
        issue(
          "error",
          "document_id_mismatch",
          record.row.code,
          "原本メタデータと文書IDが一致しません",
          version.metadata.id,
        ),
      )
    }
    if (version.row.reviewDueOn !== null && version.row.reviewDueOn < businessDate) {
      issues.push(
        issue(
          "warning",
          "review_overdue",
          record.row.code,
          `見直し期限 ${version.row.reviewDueOn} を過ぎています`,
          null,
        ),
      )
    }
    for (const reference of version.references) {
      if (!known[reference.kind].has(reference.code)) {
        issues.push(
          issue(
            "error",
            "dangling_reference",
            record.row.code,
            "参照先が存在しません",
            `${reference.kind}:${reference.code}`,
          ),
        )
      }
    }
    const roleCodes = new Set(
      version.references
        .filter((reference) => reference.kind === "org_role")
        .map((reference) => reference.code),
    )
    for (const roleCode of roleCodes) {
      const resolved = await resolveRole(roleCode)
      if (resolved instanceof Error) {
        issues.push(
          issue(
            "error",
            "role_resolution_failed",
            record.row.code,
            "組織ロールを解決できません",
            `org_role:${roleCode}`,
          ),
        )
      } else if (resolved.length === 0) {
        issues.push(
          issue(
            "error",
            "role_unassigned",
            record.row.code,
            "参照する組織ロールに現在の担当者がいません",
            `org_role:${roleCode}`,
          ),
        )
      }
    }
    for (const name of currentNames) {
      if (version.row.bodyMd.includes(name)) {
        issues.push(
          issue(
            "warning",
            "hardcoded_employee_name",
            record.row.code,
            "本文に現在の従業員名が直接記載されています",
            name,
          ),
        )
      }
    }
    for (const name of departmentNames) {
      if (version.row.bodyMd.includes(name)) {
        issues.push(
          issue(
            "warning",
            "hardcoded_department_name",
            record.row.code,
            "本文に現在の部署表示名が直接記載されています",
            name,
          ),
        )
      }
    }
    findAuthorityRuleOverlaps(version.metadata.authority_rules).forEach((message) => {
      issues.push(issue("warning", "authority_rule_overlap", record.row.code, message, null))
    })
  }

  for (const role of roles) {
    const resolved = await resolveRole(role.code)
    if (resolved instanceof Error) continue
    if (role.cardinality === "one" && resolved.length > 1) {
      issues.push(
        issue(
          "error",
          "role_cardinality",
          null,
          "単一責任の組織ロールに複数の担当者がいます",
          `org_role:${role.code}`,
        ),
      )
    }
    if (role.cardinality === "per_department") {
      const covered = new Set(resolved.map((item) => item.department_code).filter(Boolean))
      const missing = organization.departments.filter((department) => !covered.has(department.code))
      for (const department of missing) {
        issues.push(
          issue(
            "error",
            "department_role_unassigned",
            null,
            "部門単位の責任者が未設定です",
            `${role.code}:${department.code}`,
          ),
        )
      }
    }
  }

  const deduped = [...new Map(issues.map((item) => [JSON.stringify(item), item])).values()]
  return {
    checked_at: c.env.NOW ?? new Date().toISOString(),
    organization_source: organization.source,
    document_count: records.length,
    summary: {
      errors: deduped.filter((item) => item.severity === "error").length,
      warnings: deduped.filter((item) => item.severity === "warning").length,
    },
    issues: deduped,
  }
}
