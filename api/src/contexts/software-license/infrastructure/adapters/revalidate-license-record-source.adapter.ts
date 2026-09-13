import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureLicenseRecordAdapter } from "@/contexts/software-license/infrastructure/adapters/capture-license-record.adapter"
import { LicenseError } from "@/contexts/software-license/domain/errors"

type Context = SoftwareLicenseContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateLicenseRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "software-license" ||
      source.props.recordKind !== "license-record"
    )
      return new LicenseError("forbidden", "record source does not belong to this license registry")

    const current = await new CaptureLicenseRecordAdapter(this.c).prepare({
      licenseId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new LicenseError(
        "license_conflict",
        "license record differs from preservation proposal",
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
