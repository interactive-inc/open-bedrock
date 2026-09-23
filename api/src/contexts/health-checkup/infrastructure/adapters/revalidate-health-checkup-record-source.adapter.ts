import type { HealthCheckupContext } from "@/contexts/health-checkup/configuration/health-checkup-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureHealthCheckupRecordAdapter } from "@/contexts/health-checkup/infrastructure/adapters/capture-health-checkup-record.adapter"
import { HealthCheckupError } from "@/contexts/health-checkup/domain/errors"

type Context = HealthCheckupContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateHealthCheckupRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "health-checkup" ||
      source.props.recordKind !== "health-checkup-record"
    )
      return new HealthCheckupError(
        "forbidden",
        "record source does not belong to this health-checkup registry",
      )

    const current = await new CaptureHealthCheckupRecordAdapter(this.c).prepare({
      healthCheckupId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new HealthCheckupError(
        "health_checkup_conflict",
        "health-checkup record differs from preservation proposal",
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
