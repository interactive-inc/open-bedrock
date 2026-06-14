import {
  reviewCycleStatusSchema,
  toReviewCycleStatus,
} from "@/domain/review/review-cycle-status.value"
import type { ReviewCycleRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  period: z.string(),
  status: reviewCycleStatusSchema,
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
      status: toReviewCycleStatus(row.status),
      dueDate: row.dueDate,
    })
  }

  /**
   * draft → open への状態遷移。draft 以外からは遷移不可。
   */
  open(): ReviewCycle | null {
    if (this.status !== "draft") {
      return null
    }
    return new ReviewCycle({ ...this.props, status: "open" })
  }

  /**
   * open → closed への状態遷移。open 以外からは遷移不可。
   */
  close(): ReviewCycle | null {
    if (this.status !== "open") {
      return null
    }
    return new ReviewCycle({ ...this.props, status: "closed" })
  }

  /**
   * 削除可能かどうか。draft 状態のみ削除を許可する。
   */
  get isDeletable(): boolean {
    return this.status === "draft"
  }

  withDetails(details: { title: string; period: string; dueDate: string | null }) {
    return new ReviewCycle({
      ...this.props,
      title: details.title,
      period: details.period,
      dueDate: details.dueDate,
    })
  }
}
