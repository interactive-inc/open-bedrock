import type { RoomReservationRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  roomId: z.number(),
  reserverId: z.number(),
  startAt: z.string(),
  endAt: z.string(),
  purpose: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 会議室予約（重複は start_at/end_at の範囲で判定）。集約ルート。
export class RoomReservation implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly roomId!: Props["roomId"]

  readonly reserverId!: Props["reserverId"]

  readonly startAt!: Props["startAt"]

  readonly endAt!: Props["endAt"]

  readonly purpose!: Props["purpose"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規予約を組み立てる。id は crypto.randomUUID() で採番する。
  static create(props: {
    roomId: number
    reserverId: number
    startAt: string
    endAt: string
    purpose: string | null
  }): RoomReservation {
    return new RoomReservation({
      id: crypto.randomUUID(),
      roomId: props.roomId,
      reserverId: props.reserverId,
      startAt: props.startAt,
      endAt: props.endAt,
      purpose: props.purpose,
    })
  }

  static fromRow(row: RoomReservationRow): RoomReservation {
    return new RoomReservation({
      id: row.id,
      roomId: row.roomId,
      reserverId: row.reserverId,
      startAt: row.startAt,
      endAt: row.endAt,
      purpose: row.purpose,
    })
  }

  // 用途を変更した新しい予約を返す。
  withPurpose(purpose: string | null) {
    return new RoomReservation({ ...this.props, purpose })
  }

  // 開始終了時刻を変更した新しい予約を返す。
  withRescheduled(props: { startAt: string; endAt: string }) {
    return new RoomReservation({
      ...this.props,
      startAt: props.startAt,
      endAt: props.endAt,
    })
  }
}
