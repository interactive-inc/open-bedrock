import type { RentalReservationContext } from "@/contexts/rental/configuration/rental-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureRentalReservationRecordAdapter } from "@/contexts/rental/infrastructure/adapters/capture-rental-reservation-record.adapter"
import { RentalReservationError } from "@/contexts/rental/domain/errors"

type Context = RentalReservationContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateRentalReservationRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "rental" ||
      source.props.recordKind !== "rental-reservation-record"
    )
      return new RentalReservationError(
        "forbidden",
        "record source does not belong to this rental registry",
      )

    const current = await new CaptureRentalReservationRecordAdapter(this.c).prepare({
      rentalReservationId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new RentalReservationError(
        "rental_reservation_conflict",
        "rental record differs from preservation proposal",
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
