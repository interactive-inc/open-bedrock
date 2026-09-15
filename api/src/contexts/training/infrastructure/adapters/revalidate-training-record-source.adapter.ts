import type { TrainingContext } from "@/contexts/training/configuration/training-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureTrainingRecordAdapter } from "@/contexts/training/infrastructure/adapters/capture-training-record.adapter"
import { TrainingError } from "@/contexts/training/domain/errors"
import { trainingRecordKindSchema } from "@/contexts/training/domain/training-record-kind"

type Context = TrainingContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateTrainingRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "training"
    )
      return new TrainingError("forbidden", "record source does not belong to this training registry")

    const recordKind = trainingRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new TrainingError("forbidden", "invalid training record kind")
    const current = await new CaptureTrainingRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new TrainingError(
        "training_conflict",
        "training record differs from preservation proposal",
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
