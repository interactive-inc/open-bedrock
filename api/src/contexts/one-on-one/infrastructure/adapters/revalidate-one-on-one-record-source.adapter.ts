import type { OneOnOneContext } from "@/contexts/one-on-one/configuration/one-on-one-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureOneOnOneRecordAdapter } from "@/contexts/one-on-one/infrastructure/adapters/capture-one-on-one-record.adapter"
import { OneOnOneError } from "@/contexts/one-on-one/domain/errors"

type Context = OneOnOneContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateOneOnOneRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "one-on-one" ||
      source.props.recordKind !== "one-on-one-record"
    )
      return new OneOnOneError(
        "forbidden",
        "record source does not belong to this one-on-one registry",
      )

    const current = await new CaptureOneOnOneRecordAdapter(this.c).prepare({
      oneOnOneId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new OneOnOneError(
        "one_on_one_conflict",
        "one-on-one record differs from preservation proposal",
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
