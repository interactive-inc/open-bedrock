import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { GovernanceOrgRoleAssignmentAdoptionResult } from "@/contexts/governance/infrastructure/adapters/governance-org-role-assignment-adoption.adapter"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"

type Props = Readonly<{
  session: CompanySessionValue
  assignmentId: number
  freezeId: string
  commandId: string
  expectedRevision: number
  snapshotDigest: string
}>

type Context = Readonly<{
  adopt: (props: Props) => Promise<GovernanceOrgRoleAssignmentAdoptionResult>
}>

/** 凍結した旧組織ロール割当を、元記録の証跡とともにCompany責務履歴へ接続する。 */
export class AdoptGovernanceOrgRoleAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を移行する権限がありません", "governance_role_forbidden")
    }
    const result = await this.c.adopt(props)
    if (result.kind === "assigned") return result
    if (result.kind === "source_namespace_missing")
      return new UnexpectedError("組織責任の移行元を特定できません")
    if (result.kind === "source_not_frozen")
      return new ConflictError(
        "組織責任の元台帳を停止してから移行してください",
        "governance_role_source_not_frozen",
      )
    if (result.kind === "source_unavailable")
      return new UnexpectedError("組織責任の元記録を確認できません", { cause: result.cause })
    if (result.kind === "source_not_found")
      return new NotFoundError("組織責任の元記録がありません", "governance_assignment_not_found")
    if (result.kind === "source_conflict")
      return new ConflictError(
        "組織責任の元記録が変更されています",
        "governance_role_source_conflict",
      )
    if (result.kind === "source_invalid")
      return new ValidationError("組織責任の定義が移行できません", "governance_role_source_invalid")
    if (result.kind === "forbidden")
      return new ForbiddenError(
        "Companyの責務を変更する権限がありません",
        "governance_role_forbidden",
      )
    if (result.kind === "conflict")
      return new ConflictError("会社版が更新されています", "governance_role_revision_conflict")
    if (result.kind === "command_conflict")
      return new ConflictError(
        "冪等キーが別の操作に使われています",
        "governance_role_command_conflict",
      )
    if (result.kind === "overlap")
      return new ConflictError("移行先の組織責任と重複します", "governance_role_overlap")
    if (result.kind === "resource_conflict")
      return new ConflictError(
        "移行先の責務履歴が更新されています",
        "governance_role_resource_conflict",
      )
    if (result.kind === "invalid")
      return new ValidationError("Companyの責務参照が不正です", "governance_role_reference_invalid")
    return new UnexpectedError("組織責任をCompanyへ移行できません", { cause: result.cause })
  }
}
