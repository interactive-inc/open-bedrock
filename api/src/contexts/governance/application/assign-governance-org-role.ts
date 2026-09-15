import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import { findGovernanceOrgRole } from "@/contexts/governance/domain/catalogs/governance-org-role.catalog"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import type { Context as HonoContext } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import { isoDate } from "@/lib/validation/iso-date.schema"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.assigned"
    targetType: "governance_org_role"
    targetId: string
    metadata?: SystemJsonValue
  }) => ReadonlyArray<D1PreparedStatement>
}>

/** 組織責任をCompanyの公開責務履歴へ割り当てる。 */
export class AssignGovernanceOrgRole {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    commandId: string
    expectedRevision: number
    orgRoleCode: string
    employeeCode: string
    departmentCode: string | null
    startsOn: string
    endsOn: string | null
    sourceDocumentCode: string | null
  }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を割り当てる権限がありません", "governance_role_forbidden")
    }
    if (
      !isoDate.safeParse(props.startsOn).success ||
      (props.endsOn !== null && !isoDate.safeParse(props.endsOn).success) ||
      (props.endsOn !== null && props.startsOn >= props.endsOn)
    ) {
      return new ValidationError("有効期間が不正です", "governance_role_period_invalid")
    }
    const role = findGovernanceOrgRole(props.orgRoleCode)
    if (role === null) {
      return new NotFoundError("組織ロールがありません", "governance_role_not_found")
    }
    if (role.assignmentMode !== "manual") {
      return new ConflictError(
        "この組織ロールは組織図から自動解決されます",
        "governance_role_derived",
      )
    }
    if (role.cardinality === "per_department" && props.departmentCode === null) {
      return new ValidationError(
        "部門単位のロールには部署が必要です",
        "governance_role_department_required",
      )
    }

    const result = await new CompanyGovernanceRoleAssignmentWriteAdapter({
      actor: CompanyActorValue.restore({
        accountId: String(props.session.accountId),
        employeeId: String(props.session.employeeId),
        organizationIds: ["organization:default"],
        capabilities: ["company:write"],
      }),
      database: this.c.context.env.DB,
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.org_role.assigned",
        targetType: "governance_org_role",
        targetId: role.code,
        metadata: {
          employee_code: props.employeeCode,
          department_code: props.departmentCode,
          starts_on: props.startsOn,
          ends_on: props.endsOn,
        },
      }),
    }).assign({
      organizationId: "organization:default",
      commandId: props.commandId,
      expectedRevision: props.expectedRevision,
      responsibilityCode: role.code,
      responsibilityName: role.name,
      cardinality: role.cardinality,
      employeeCode: props.employeeCode,
      departmentCode: props.departmentCode,
      startsOn: restoreCalendarDate(props.startsOn),
      endsOn: props.endsOn === null ? null : restoreCalendarDate(props.endsOn),
      sourceDocumentCode: props.sourceDocumentCode,
      recordedAt: new Date(this.c.context.env.NOW ?? Date.now()).getTime(),
    })
    if (result.kind === "assigned") {
      return {
        id: result.assignmentId,
        orgRoleCode: role.code,
        employeeCode: props.employeeCode,
        departmentCode: props.departmentCode,
        startsOn: props.startsOn,
        endsOn: props.endsOn,
        sourceDocumentCode: props.sourceDocumentCode,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      }
    }
    if (result.kind === "forbidden") {
      return new ForbiddenError("会社の責務を変更する権限がありません", "governance_role_forbidden")
    }
    if (result.kind === "conflict") {
      return new ConflictError("会社版が更新されています", "governance_role_revision_conflict")
    }
    if (result.kind === "command_conflict") {
      return new ConflictError(
        "冪等キーが別の操作に使われています",
        "governance_role_command_conflict",
      )
    }
    if (result.kind === "overlap") {
      return new ConflictError("指定期間の組織責任と重複します", "governance_role_overlap")
    }
    if (result.kind === "resource_conflict") {
      return new ConflictError("Companyの責務資源が更新されています", "governance_role_resource_conflict")
    }
    if (result.kind === "invalid") {
      return new ValidationError("Companyの責務参照が不正です", "governance_role_reference_invalid")
    }
    return new UnexpectedError("組織責任を割り当てられません", { cause: result.cause })
  }
}
