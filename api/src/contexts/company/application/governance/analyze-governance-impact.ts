import type { Session } from "@/contexts/company/domain/iam/session"
import { resolveGovernanceOrgRole } from "@/contexts/company/application/governance/resolve-governance-org-role"
import type { Context } from "@/env"
import { GovernanceRepository } from "@/contexts/company/infrastructure/governance/governance-repository"
import { PERMISSION_KEYS } from "@/composition/iam/permission-key.catalog"
import { loadCurrentOrganization } from "@/contexts/company/application/organization/current-organization-read-model"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import { employees, governanceDocuments, trainingCourses } from "@/schema"

export type GovernanceImpactIssue = {
  severity: "error" | "warning"
  code: string
  document_code: string | null
  message: string
  reference: string | null
}

export type GovernanceImpactReport = {
  checked_at: string
  organization_source: "lifecycle" | "legacy"
  document_count: number
  summary: { errors: number; warnings: number }
  issues: ReadonlyArray<GovernanceImpactIssue>
}

export class AnalyzeGovernanceImpact {
  constructor(private readonly c: Context) {}

  async run(session: Session): Promise<GovernanceImpactReport | Error> {
    if (!session.permissions.has("governance:manage")) {
      return new ForbiddenError(
        "規程の影響検査を実行する権限がありません",
        "governance_impact_forbidden",
      )
    }
    const repository = new GovernanceRepository(this.c)
    const [records, roles, capabilities, organization, employeeRows, trainingRows, documents] =
      await Promise.all([
        repository.listDocuments(true),
        repository.listOrgRoles(),
        repository.listCapabilities(),
        loadCurrentOrganization(this.c),
        this.c.var.database.select({ name: employees.name }).from(employees),
        this.c.var.database.select({ code: trainingCourses.code }).from(trainingCourses),
        this.c.var.database
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
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) {
      return new UnexpectedError("会社営業日を解決できません", { cause: businessDate })
    }
    const issues: Array<GovernanceImpactIssue> = []
    const known = {
      capability: new Set(capabilities.map((item) => item.code)),
      org_role: new Set(roles.map((item) => item.code)),
      permission: new Set<string>(PERMISSION_KEYS),
      training: new Set(trainingRows.map((item) => item.code)),
      policy: new Set(documents.filter((item) => item.kind === "policy").map((item) => item.code)),
      procedure: new Set(
        documents.filter((item) => item.kind === "procedure").map((item) => item.code),
      ),
      guideline: new Set(
        documents.filter((item) => item.kind === "guideline").map((item) => item.code),
      ),
      control: new Set(
        documents.filter((item) => item.kind === "control").map((item) => item.code),
      ),
    }
    const roleCache = new Map<string, Awaited<ReturnType<typeof resolveGovernanceOrgRole>>>()
    const resolveRole = async (code: string) => {
      const cached = roleCache.get(code)
      if (cached !== undefined) return cached
      const resolved = await resolveGovernanceOrgRole({ c: this.c, code })
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
        const missing = organization.departments.filter(
          (department) => !covered.has(department.code),
        )
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
      checked_at: this.c.env.NOW ?? new Date().toISOString(),
      organization_source: organization.source,
      document_count: records.length,
      summary: {
        errors: deduped.filter((item) => item.severity === "error").length,
        warnings: deduped.filter((item) => item.severity === "warning").length,
      },
      issues: deduped,
    }
  }
}

function issue(
  severity: GovernanceImpactIssue["severity"],
  code: string,
  documentCode: string | null,
  message: string,
  reference: string | null,
): GovernanceImpactIssue {
  return { severity, code, document_code: documentCode, message, reference }
}

function findAuthorityRuleOverlaps(
  rules: ReadonlyArray<{
    key: string
    capability: string
    action: string
    amount_min: number | null
    amount_max: number | null
  }>,
): ReadonlyArray<string> {
  const messages: Array<string> = []
  for (const [index, left] of rules.entries()) {
    for (const right of rules.slice(index + 1)) {
      if (left.capability !== right.capability || left.action !== right.action) continue
      const leftMin = left.amount_min ?? Number.NEGATIVE_INFINITY
      const leftMax = left.amount_max ?? Number.POSITIVE_INFINITY
      const rightMin = right.amount_min ?? Number.NEGATIVE_INFINITY
      const rightMax = right.amount_max ?? Number.POSITIVE_INFINITY
      if (leftMin <= rightMax && rightMin <= leftMax) {
        messages.push(`権限ルール ${left.key} と ${right.key} の条件範囲が重複しています`)
      }
    }
  }
  return messages
}
