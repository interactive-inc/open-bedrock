import type { LifeEventRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  employeeId: z.number(),
  eventType: z.string(),
  eventDate: z.string(),
  detail: z.string().nullable(),
  status: z.enum(["submitted", "approved", "rejected"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// ライフイベント届出（種別・発生日・詳細の記録。法的判定や給付金計算は持たず記録のみ）。集約ルート。
export class LifeEvent implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly eventType!: Props["eventType"]

  readonly eventDate!: Props["eventDate"]

  readonly detail!: Props["detail"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規ライフイベント届出を組み立てる。id は crypto.randomUUID() で採番し、status は "submitted" で作成する。
  static create(props: {
    employeeId: number
    eventType: string
    eventDate: string
    detail: string | null
    createdAt: string
  }): LifeEvent {
    return new LifeEvent({
      id: crypto.randomUUID(),
      employeeId: props.employeeId,
      eventType: props.eventType,
      eventDate: props.eventDate,
      detail: props.detail,
      status: "submitted",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: LifeEventRow): LifeEvent {
    return new LifeEvent({
      id: row.id,
      employeeId: row.employeeId,
      eventType: row.eventType,
      eventDate: row.eventDate,
      detail: row.detail,
      status: zProps.shape.status.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  get isModifiable(): boolean {
    return this.status === "submitted"
  }

  // 届出内容を変更した新しいライフイベント届出を返す。
  withDetails(props: { eventType: string; eventDate: string; detail: string | null }): LifeEvent {
    return new LifeEvent({
      ...this.props,
      eventType: props.eventType,
      eventDate: props.eventDate,
      detail: props.detail,
    })
  }
}
