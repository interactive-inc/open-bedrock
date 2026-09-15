import type { ThanksContext } from "@/contexts/thanks/configuration/thanks-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureThanksRecordAdapter } from "@/contexts/thanks/infrastructure/adapters/capture-thanks-record.adapter"
import { ThanksError } from "@/contexts/thanks/domain/errors"
import { thanksRecordKindSchema } from "@/contexts/thanks/domain/definitions/thanks-record-kind.definition"

type Context = ThanksContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateThanksRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "thanks"
    )
      return new ThanksError("forbidden", "record source does not belong to this thanks registry")

    const recordKind = thanksRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new ThanksError("forbidden", "invalid thanks record kind")
    const current = await new CaptureThanksRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new ThanksError("thanks_conflict", "thanks record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
