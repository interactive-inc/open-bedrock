import type { ThanksRedemptionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  rewardId: z.number(),
  pointCost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  deciderId: z.number().nullable(),
})

type Props = z.infer<typeof zProps>

// 交換申請の1件。集約ルート。状態は申請(pending)→確定(fulfilled)/却下(rejected)。
// 承認＝確定の状態遷移は二重消費を原子的に防ぐため repository の条件付き UPDATE で行う。
export class ThanksRedemption implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly rewardId!: Props["rewardId"]

  readonly pointCost!: Props["pointCost"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  readonly decidedAt!: Props["decidedAt"]

  readonly deciderId!: Props["deciderId"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の交換申請を組み立てる。初期状態は pending。
  static create(props: {
    employeeId: number
    rewardId: number
    pointCost: number
    createdAt: string
  }): ThanksRedemption {
    return new ThanksRedemption({
      id: null,
      employeeId: props.employeeId,
      rewardId: props.rewardId,
      pointCost: props.pointCost,
      status: "pending",
      createdAt: props.createdAt,
      decidedAt: null,
      deciderId: null,
    })
  }

  static fromRow(row: ThanksRedemptionRow): ThanksRedemption {
    return new ThanksRedemption({
      id: row.id,
      employeeId: row.employeeId,
      rewardId: row.rewardId,
      pointCost: row.pointCost,
      status: row.status,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
      deciderId: row.deciderId,
    })
  }
}
