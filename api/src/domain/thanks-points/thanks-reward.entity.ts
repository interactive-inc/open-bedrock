import { maxRewardPointCost } from "@/lib/thanks-points/monthly-budget-points"
import type { ThanksRewardRow } from "@/schema"
import { z } from "zod"

/** カタログ名は必須・最大長 200。交換コストは 1 以上・整数・上限あり。在庫は null（無制限）か 0 以上の整数。 */
export const rewardNameSchema = z.string().trim().min(1).max(200)

export const rewardPointCostSchema = z.number().int().positive().max(maxRewardPointCost)

export const rewardStockSchema = z.number().int().min(0).nullable()

const zProps = z.object({
  id: z.number().nullable(),
  name: z.string(),
  pointCost: z.number(),
  isActive: z.boolean(),
  stock: z.number().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 交換カタログの1件。集約ルート。 */
export class ThanksReward implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly name!: Props["name"]

  readonly pointCost!: Props["pointCost"]

  readonly isActive!: Props["isActive"]

  readonly stock!: Props["stock"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規カタログを組み立てる。名前・コスト・在庫の不備は Error。 */
  static create(props: {
    name: string
    pointCost: number
    stock: number | null
    createdAt: string
  }): ThanksReward | Error {
    const parsedName = rewardNameSchema.safeParse(props.name)

    if (parsedName.success === false) {
      return new Error("reward name is required and must be at most 200 characters")
    }

    const parsedCost = rewardPointCostSchema.safeParse(props.pointCost)

    if (parsedCost.success === false) {
      return new Error("point cost must be a positive integer within the allowed range")
    }

    const parsedStock = rewardStockSchema.safeParse(props.stock)

    if (parsedStock.success === false) {
      return new Error("stock must be null or a non-negative integer")
    }

    return new ThanksReward({
      id: null,
      name: parsedName.data,
      pointCost: parsedCost.data,
      isActive: true,
      stock: parsedStock.data,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ThanksRewardRow): ThanksReward {
    return new ThanksReward({
      id: row.id,
      name: row.name,
      pointCost: row.pointCost,
      isActive: row.isActive,
      stock: row.stock,
      createdAt: row.createdAt,
    })
  }

  withActive(isActive: boolean): ThanksReward {
    return new ThanksReward({ ...this.props, isActive })
  }
}
