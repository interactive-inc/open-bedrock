import type { RingiContext } from "@/contexts/ringi/configuration/ringi-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureRingiRecordAdapter } from "@/contexts/ringi/infrastructure/adapters/capture-ringi-record.adapter"
import { RingiError } from "@/contexts/ringi/domain/errors"
import { ringiRecordKindSchema } from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"

type Context = RingiContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateRingiRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "ringi"
    )
      return new RingiError("forbidden", "record source does not belong to this ringi registry")

    const recordKind = ringiRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new RingiError("forbidden", "invalid ringi record kind")
    const current = await new CaptureRingiRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new RingiError("ringi_conflict", "ringi record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
