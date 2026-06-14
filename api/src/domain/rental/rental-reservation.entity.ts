import type { RentalReservationRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  requesterId: z.number(),
  itemName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  purpose: z.string().nullable(),
  status: z.enum(["requested"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** レンタル予約（物の貸与を期間と用途で申請・記録する）。集約ルート。 */
export class RentalReservation implements Props {
  /** id は UUID。新規作成時に採番する。 */
  readonly id!: Props["id"]

  readonly requesterId!: Props["requesterId"]

  readonly itemName!: Props["itemName"]

  readonly startDate!: Props["startDate"]

  readonly endDate!: Props["endDate"]

  readonly purpose!: Props["purpose"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規予約を組み立てる。id は crypto.randomUUID() で採番し、初期状態は requested。 */
  static create(props: {
    requesterId: number
    itemName: string
    startDate: string
    endDate: string
    purpose: string | null
    createdAt: string
  }): RentalReservation | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

    return new RentalReservation({
      id: crypto.randomUUID(),
      requesterId: props.requesterId,
      itemName: props.itemName,
      startDate: props.startDate,
      endDate: props.endDate,
      purpose: props.purpose,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RentalReservationRow): RentalReservation {
    return new RentalReservation({
      id: row.id,
      requesterId: row.requesterId,
      itemName: row.itemName,
      startDate: row.startDate,
      endDate: row.endDate,
      purpose: row.purpose,
      status: zProps.shape.status.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 用途を変更した新しい予約を返す。 */
  withPurpose(purpose: string | null) {
    return new RentalReservation({ ...this.props, purpose })
  }

  /** 品名と期間を変更した新しい予約を返す。 */
  withDetails(props: {
    itemName: string
    startDate: string
    endDate: string
  }): RentalReservation | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

    return new RentalReservation({
      ...this.props,
      itemName: props.itemName,
      startDate: props.startDate,
      endDate: props.endDate,
    })
  }
}
