import type { HeadcountPlanContext } from "@/contexts/headcount-plan/configuration/headcount-plan-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureHeadcountPlanRecordAdapter } from "@/contexts/headcount-plan/infrastructure/adapters/capture-headcount-plan-record.adapter"
import { HeadcountPlanError } from "@/contexts/headcount-plan/domain/errors"

type Context = HeadcountPlanContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateHeadcountPlanRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "headcount-plan" ||
      source.props.recordKind !== "headcount-plan-record"
    )
      return new HeadcountPlanError("forbidden", "record source does not belong to this headcount-plan registry")

    const current = await new CaptureHeadcountPlanRecordAdapter(this.c).prepare({
      headcountPlanId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new HeadcountPlanError(
        "headcount_plan_conflict",
        "headcount-plan record differs from preservation proposal",
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
