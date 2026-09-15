import type { AntisocialCheckContext } from "@/contexts/antisocial-check/configuration/antisocial-check-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureAntisocialCheckRecordAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/capture-antisocial-check-record.adapter"
import { AntisocialCheckError } from "@/contexts/antisocial-check/domain/errors"

type Context = AntisocialCheckContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateAntisocialCheckRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "antisocial-check" ||
      source.props.recordKind !== "antisocial-check-record"
    )
      return new AntisocialCheckError("forbidden", "record source does not belong to this antisocial-check registry")

    const current = await new CaptureAntisocialCheckRecordAdapter(this.c).prepare({
      antisocialCheckId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new AntisocialCheckError(
        "antisocial_check_conflict",
        "antisocial-check record differs from preservation proposal",
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
