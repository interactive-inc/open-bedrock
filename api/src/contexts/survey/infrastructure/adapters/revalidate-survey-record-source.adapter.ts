import type { SurveyContext } from "@/contexts/survey/configuration/survey-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureSurveyRecordAdapter } from "@/contexts/survey/infrastructure/adapters/capture-survey-record.adapter"
import { SurveyError } from "@/contexts/survey/domain/errors"
import { surveyRecordKindSchema } from "@/contexts/survey/domain/definitions/survey-record-kind.definition"

type Context = SurveyContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateSurveyRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "survey"
    )
      return new SurveyError("forbidden", "record source does not belong to this survey registry")

    const recordKind = surveyRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new SurveyError("forbidden", "invalid survey record kind")
    const current = await new CaptureSurveyRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new SurveyError("survey_conflict", "survey record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
