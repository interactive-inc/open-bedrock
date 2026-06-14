import type { ThanksPointBudgetRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  period: z.string(),
  grantedPoints: z.number(),
  consumedPoints: z.number(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 月次の贈与原資レコード。集約ルート。残量は granted − consumed で算出する。 */
export class ThanksPointBudget implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly period!: Props["period"]

  readonly grantedPoints!: Props["grantedPoints"]

  readonly consumedPoints!: Props["consumedPoints"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    employeeId: number
    period: string
    grantedPoints: number
    createdAt: string
  }): ThanksPointBudget {
    return new ThanksPointBudget({
      id: null,
      employeeId: props.employeeId,
      period: props.period,
      grantedPoints: props.grantedPoints,
      consumedPoints: 0,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ThanksPointBudgetRow): ThanksPointBudget {
    return new ThanksPointBudget({
      id: row.id,
      employeeId: row.employeeId,
      period: row.period,
      grantedPoints: row.grantedPoints,
      consumedPoints: row.consumedPoints,
      createdAt: row.createdAt,
    })
  }

  /** 残量。granted − consumed。下限は 0（負にしない）。 */
  get remainingPoints(): number {
    const remaining = this.props.grantedPoints - this.props.consumedPoints

    return remaining < 0 ? 0 : remaining
  }
}
