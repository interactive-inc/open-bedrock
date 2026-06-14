import type { BusinessTripRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  travelerId: z.number(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  purpose: z.string(),
  estimatedCost: z.number().nullable(),
  status: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 出張申請（行き先・期間・目的・概算費用の記録。金額の計算や判定は持たず記録のみ）。集約ルート。
export class BusinessTrip implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly travelerId!: Props["travelerId"]

  readonly destination!: Props["destination"]

  readonly startDate!: Props["startDate"]

  readonly endDate!: Props["endDate"]

  readonly purpose!: Props["purpose"]

  readonly estimatedCost!: Props["estimatedCost"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規出張申請を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。
  static create(props: {
    travelerId: number
    destination: string
    startDate: string
    endDate: string
    purpose: string
    estimatedCost: number | null
    createdAt: string
  }): BusinessTrip | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

    return new BusinessTrip({
      id: crypto.randomUUID(),
      travelerId: props.travelerId,
      destination: props.destination,
      startDate: props.startDate,
      endDate: props.endDate,
      purpose: props.purpose,
      estimatedCost: props.estimatedCost,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: BusinessTripRow): BusinessTrip {
    return new BusinessTrip({
      id: row.id,
      travelerId: row.travelerId,
      destination: row.destination,
      startDate: row.startDate,
      endDate: row.endDate,
      purpose: row.purpose,
      estimatedCost: row.estimatedCost,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  get isModifiable(): boolean {
    return this.status === "requested"
  }

  // 申請内容を変更した新しい出張申請を返す。
  withDetails(props: {
    destination: string
    startDate: string
    endDate: string
    purpose: string
    estimatedCost: number | null
  }): BusinessTrip | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

    return new BusinessTrip({
      ...this.props,
      destination: props.destination,
      startDate: props.startDate,
      endDate: props.endDate,
      purpose: props.purpose,
      estimatedCost: props.estimatedCost,
    })
  }
}
