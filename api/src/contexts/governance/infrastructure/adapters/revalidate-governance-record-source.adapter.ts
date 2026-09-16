import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureGovernanceRecordAdapter } from "@/contexts/governance/infrastructure/adapters/capture-governance-record.adapter"
import { GovernanceError } from "@/contexts/governance/domain/errors"
import { governanceRecordKindSchema } from "@/contexts/governance/domain/definitions/governance-record-kind.definition"

type Context = GovernanceContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateGovernanceRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "governance"
    )
      return new GovernanceError(
        "forbidden",
        "record source does not belong to this governance registry",
      )

    const recordKind = governanceRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new GovernanceError("forbidden", "invalid governance record kind")
    const current = await new CaptureGovernanceRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new GovernanceError(
        "governance_conflict",
        "governance record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
