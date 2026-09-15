import type { CompanyCalendarDayContext } from "@/contexts/company-calendar/configuration/company-calendar-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCompanyCalendarDayRecordAdapter } from "@/contexts/company-calendar/infrastructure/adapters/capture-company-calendar-record.adapter"
import { CompanyCalendarDayError } from "@/contexts/company-calendar/domain/errors"

type Context = CompanyCalendarDayContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCompanyCalendarDayRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "company-calendar" ||
      source.props.recordKind !== "company-calendar-record"
    )
      return new CompanyCalendarDayError("forbidden", "record source does not belong to this company-calendar registry")

    const current = await new CaptureCompanyCalendarDayRecordAdapter(this.c).prepare({
      companyCalendarDayId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CompanyCalendarDayError(
        "company_calendar_conflict",
        "company-calendar record differs from preservation proposal",
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
