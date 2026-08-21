import type { Session } from "@/lib/auth/session"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context } from "@/env"
import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance.repository"
import { loadCurrentOrganization } from "@/contexts/company/infrastructure/organization/current-organization-read-model.repository"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import { isoDate } from "@/lib/schemas"

export class ManageGovernanceOrgRole {
  constructor(
    private readonly c: Context,
    private readonly prepareAudit: (props: {
      session: Session
      action: "governance.org_role.assigned" | "governance.org_role.revoked"
      targetType: "governance_org_role"
      targetId: string
      metadata?: SystemJsonValue
    }) => readonly [D1PreparedStatement, D1PreparedStatement],
  ) {}

  async assign(props: {
    session: Session
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
    const repository = new GovernanceRepository(this.c)
    const [role, assignments, organization] = await Promise.all([
      repository.findOrgRole(props.orgRoleCode),
      repository.listManualAssignments(props.orgRoleCode),
      loadCurrentOrganization(this.c),
    ])
    if (role instanceof Error || assignments instanceof Error || organization instanceof Error) {
      return new UnexpectedError("組織責任の現在状態を確認できません", {
        cause:
          role instanceof Error ? role : assignments instanceof Error ? assignments : organization,
      })
    }
    if (role === null)
      return new NotFoundError("組織ロールがありません", "governance_role_not_found")
    if (role.assignmentMode !== "manual") {
      return new ConflictError(
        "この組織ロールは組織図から自動解決されます",
        "governance_role_derived",
      )
    }
    const employee = organization.employeesByCode.get(props.employeeCode)
    if (employee === undefined) {
      return new NotFoundError("有効な従業員がありません", "governance_role_employee_not_found")
    }
    if (role.cardinality === "per_department" && props.departmentCode === null) {
      return new ValidationError(
        "部門単位のロールには部署が必要です",
        "governance_role_department_required",
      )
    }
    if (
      props.departmentCode !== null &&
      !organization.departments.some((department) => department.code === props.departmentCode)
    ) {
      return new NotFoundError("部署がありません", "governance_role_department_not_found")
    }
    const overlaps = assignments.filter((assignment) =>
      periodsOverlap(
        { startsOn: props.startsOn, endsOn: props.endsOn },
        { startsOn: assignment.startsOn, endsOn: assignment.endsOn },
      ),
    )
    const conflicts = overlaps.some((assignment) => {
      if (role.cardinality === "one") return true
      if (role.cardinality === "per_department") {
        return assignment.departmentCode === props.departmentCode
      }
      return (
        assignment.employeeId === employee.id && assignment.departmentCode === props.departmentCode
      )
    })
    if (conflicts) {
      return new ConflictError("指定期間の組織責任と重複します", "governance_role_overlap")
    }
    const saved = await repository.addAssignment({
      orgRoleCode: props.orgRoleCode,
      employeeId: employee.id,
      departmentCode: props.departmentCode,
      startsOn: props.startsOn,
      endsOn: props.endsOn,
      sourceDocumentCode: props.sourceDocumentCode,
      cardinality: role.cardinality,
      accountId: props.session.accountId,
      now: this.c.env.NOW ?? new Date().toISOString(),
      auditStatements: this.prepareAudit({
        session: props.session,
        action: "governance.org_role.assigned",
        targetType: "governance_org_role",
        targetId: props.orgRoleCode,
        metadata: {
          employee_code: props.employeeCode,
          department_code: props.departmentCode,
          starts_on: props.startsOn,
          ends_on: props.endsOn,
        },
      }),
    })
    if (saved instanceof Error) {
      return new UnexpectedError("組織責任を割り当てられません", { cause: saved })
    }
    return saved === false
      ? new ConflictError("指定期間の組織責任と重複します", "governance_role_overlap")
      : saved
  }

  async revoke(props: { session: Session; assignmentId: number }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を解除する権限がありません", "governance_role_forbidden")
    }
    const result = await new GovernanceRepository(this.c).revokeAssignment({
      id: props.assignmentId,
      accountId: props.session.accountId,
      revokedAt: this.c.env.NOW ?? new Date().toISOString(),
      auditStatements: this.prepareAudit({
        session: props.session,
        action: "governance.org_role.revoked",
        targetType: "governance_org_role",
        targetId: String(props.assignmentId),
        metadata: { assignment_id: props.assignmentId },
      }),
    })
    if (result instanceof Error) {
      return new UnexpectedError("組織責任を解除できません", { cause: result })
    }
    return result
      ? null
      : new NotFoundError("組織責任の割当がありません", "governance_assignment_not_found")
  }
}

function periodsOverlap(
  left: { startsOn: string; endsOn: string | null },
  right: { startsOn: string; endsOn: string | null },
): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}
