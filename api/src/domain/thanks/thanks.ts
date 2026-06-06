import type { ThanksRow } from "@/schema"
import { z } from "zod"

// 感謝メッセージの必須・最大長の不変条件。空白のみは不可、1000 文字まで。
export const thanksMessageSchema = z.string().trim().min(1).max(1000)

const zProps = z.object({
  id: z.number().nullable(),
  senderEmployeeId: z.number(),
  recipientEmployeeId: z.number(),
  message: z.string(),
  points: z.number(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 感謝（サンクス）1件。集約ルート。
// points は将来のポイント付与用で本 Task では常に 0。
export class Thanks implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly senderEmployeeId!: Props["senderEmployeeId"]

  readonly recipientEmployeeId!: Props["recipientEmployeeId"]

  readonly message!: Props["message"]

  readonly points!: Props["points"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の感謝を組み立てる。自己宛て送信とメッセージ不備は Error を返す。
  static create(props: {
    senderEmployeeId: number
    recipientEmployeeId: number
    message: string
    createdAt: string
  }): Thanks | Error {
    if (props.senderEmployeeId === props.recipientEmployeeId) {
      return new Error("cannot send thanks to yourself")
    }

    const parsedMessage = thanksMessageSchema.safeParse(props.message)

    if (parsedMessage.success === false) {
      return new Error("message is required and must be at most 1000 characters")
    }

    return new Thanks({
      id: null,
      senderEmployeeId: props.senderEmployeeId,
      recipientEmployeeId: props.recipientEmployeeId,
      message: parsedMessage.data,
      points: 0,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ThanksRow): Thanks {
    return new Thanks({
      id: row.id,
      senderEmployeeId: row.senderEmployeeId,
      recipientEmployeeId: row.recipientEmployeeId,
      message: row.message,
      points: row.points,
      createdAt: row.createdAt,
    })
  }
}
