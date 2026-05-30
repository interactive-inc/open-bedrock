import type { GoalRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

type Props = z.infer<typeof zProps>

// 目標（社員ごと・評価期間ごとの目標と重み・状態）。集約ルート。
export class Goal implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly period!: Props["period"]

  readonly title!: Props["title"]

  readonly kpi!: Props["kpi"]

  readonly weight!: Props["weight"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成する目標を組み立てる。id は未採番、初期状態は draft。
  static create(props: {
    employeeId: number
    period: string
    title: string
    kpi: string | null
    weight: number
  }): Goal {
    return new Goal({
      id: null,
      employeeId: props.employeeId,
      period: props.period,
      title: props.title,
      kpi: props.kpi,
      weight: props.weight,
      status: "draft",
    })
  }

  static fromRow(row: GoalRow): Goal {
    return new Goal({
      id: row.id,
      employeeId: row.employeeId,
      period: row.period,
      title: row.title,
      kpi: row.kpi,
      weight: row.weight,
      status: row.status,
    })
  }

  withStatus(status: Props["status"]) {
    return new Goal({ ...this.props, status })
  }
}
