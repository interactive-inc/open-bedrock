import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { GovernanceResponsibilityCutoverResult } from "@/contexts/governance/infrastructure/adapters/governance-responsibility-cutover.adapter"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"

type Props = Readonly<{ session: CompanySessionValue; freezeId: string }>
type Context = Readonly<{
  finalize: (props: Props) => Promise<GovernanceResponsibilityCutoverResult>
}>

/** 凍結した旧責務台帳の全件移行を検証し、旧台帳廃止の改変不能な証跡を確定する。 */
export class FinalizeGovernanceResponsibilityCutover {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError(
        "組織責任の移行を完了する権限がありません",
        "governance_role_forbidden",
      )
    }
    const result = await this.c.finalize(props)
    if (result.kind === "completed") return result
    if (result.kind === "source_namespace_missing")
      return new UnexpectedError("組織責任の移行元を特定できません")
    if (result.kind === "source_not_frozen")
      return new ConflictError(
        "指定した組織責任の元台帳は停止されていません",
        "governance_role_source_not_frozen",
      )
    if (result.kind === "receipt_conflict")
      return new ConflictError(
        "組織責任の移行完了証跡が一致しません",
        "governance_role_cutover_conflict",
      )
    if (result.kind === "coverage_incomplete")
      return new ConflictError(
        "Companyへ移行されていない組織責任があります",
        "governance_role_cutover_incomplete",
      )
    return new UnexpectedError("組織責任の移行を完了できません", {
      cause: result.kind === "unavailable" ? result.cause : undefined,
    })
  }
}
