import type { ReviewCycleRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  period: z.string(),
  status: z.enum(["draft", "open", "closed"]),
  dueDate: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 評価サイクル（多面評価の実施単位・期間・状態）。集約ルート。
export class ReviewCycle implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly period!: Props["period"]

  readonly status!: Props["status"]

  readonly dueDate!: Props["dueDate"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成する評価サイクルを組み立てる。id は未採番、初期状態は draft。
  static create(props: { title: string; period: string; dueDate: string | null }): ReviewCycle {
    return new ReviewCycle({
      id: null,
      title: props.title,
      period: props.period,
      status: "draft",
      dueDate: props.dueDate,
    })
  }

  static fromRow(row: ReviewCycleRow): ReviewCycle {
    return new ReviewCycle({
      id: row.id,
      title: row.title,
      period: row.period,
      status: toCycleStatus(row.status),
      dueDate: row.dueDate,
    })
  }

  withStatus(status: Props["status"]) {
    return new ReviewCycle({ ...this.props, status })
  }
}

function toCycleStatus(value: string): "draft" | "open" | "closed" {
  if (value === "open") {
    return "open"
  }

  if (value === "closed") {
    return "closed"
  }

  return "draft"
}
