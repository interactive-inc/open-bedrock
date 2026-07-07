import { ringiStatusSchema } from "@/lib/schemas"
import type { RingiRequestRow } from "@/schema"
import { z } from "zod"

/** D1 batch の結果行を安全にパースする。fromRow の引数型に対応する。 */
export const ringiRequestRowSchema = z.object({
  id: z.number(),
  applicantId: z.number(),
  approverId: z.number(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  decidedAt: z.string().nullable(),
  decisionComment: z.string().nullable(),
  createdAt: z.string(),
})

const zProps = z.object({
  id: z.number().nullable(),
  applicantId: z.number(),
  approverId: z.number(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: ringiStatusSchema,
  decidedAt: z.string().nullable(),
  decisionComment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 稟議申請（金額つきの汎用決裁。単段決裁で、決裁結果を行に inline 保持する）。集約ルート。 */
export class RingiRequest implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly applicantId!: Props["applicantId"]

  readonly approverId!: Props["approverId"]

  readonly title!: Props["title"]

  readonly amount!: Props["amount"]

  readonly reason!: Props["reason"]

  readonly status!: Props["status"]

  readonly decidedAt!: Props["decidedAt"]

  readonly decisionComment!: Props["decisionComment"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規に起案する稟議を組み立てる。id は未採番、初期状態は pending。 */
  static create(props: {
    applicantId: number
    approverId: number
    title: string
    amount: number
    reason: string
    createdAt: string
  }): RingiRequest {
    return new RingiRequest({
      id: null,
      applicantId: props.applicantId,
      approverId: props.approverId,
      title: props.title,
      amount: props.amount,
      reason: props.reason,
      status: "pending",
      decidedAt: null,
      decisionComment: null,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RingiRequestRow): RingiRequest {
    return new RingiRequest({
      id: row.id,
      applicantId: row.applicantId,
      approverId: row.approverId,
      title: row.title,
      amount: row.amount,
      reason: row.reason,
      status: row.status,
      decidedAt: row.decidedAt,
      decisionComment: row.decisionComment,
      createdAt: row.createdAt,
    })
  }
}
