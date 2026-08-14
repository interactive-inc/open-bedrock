import type { ThanksRow } from "@/schema"
import { z } from "zod"

/** 感謝メッセージの必須・最大長の不変条件。空白のみは不可、1000 文字まで。 */
export const thanksMessageSchema = z.string().trim().min(1).max(1000)

/** D1 batch の RETURNING 結果行を安全にパースする。fromRow の引数型に対応する。 */
export const thanksRowSchema = z.object({
  id: z.number(),
  senderEmployeeId: z.number(),
  recipientEmployeeId: z.number(),
  message: z.string(),
  points: z.number(),
  createdAt: z.string(),
})

const zProps = z.object({
  id: z.number().nullable(),
  senderEmployeeId: z.number(),
  recipientEmployeeId: z.number(),
  message: z.string(),
  points: z.number(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 感謝（サンクス）1件。集約ルート。
 * points は感謝に添えるサンクスポイント。0 はメッセージのみの感謝。負値は不可。
 */
export class Thanks implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
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

  /**
   * 新規の感謝を組み立てる。自己宛て送信・メッセージ不備・不正なポイントは Error を返す。
   * points は 0 以上の整数（呼び出し側で上限・原資チェック済みの値を渡す前提）。
   */
  static create(props: {
    senderEmployeeId: number
    recipientEmployeeId: number
    message: string
    points: number
    createdAt: string
  }): Thanks | Error {
    if (props.senderEmployeeId === props.recipientEmployeeId) {
      return new Error("cannot send thanks to yourself")
    }

    const parsedMessage = thanksMessageSchema.safeParse(props.message)

    if (parsedMessage.success === false) {
      return new Error("message is required and must be at most 1000 characters")
    }

    if (Number.isInteger(props.points) === false || props.points < 0) {
      return new Error("points must be a non-negative integer")
    }

    return new Thanks({
      id: null,
      senderEmployeeId: props.senderEmployeeId,
      recipientEmployeeId: props.recipientEmployeeId,
      message: parsedMessage.data,
      points: props.points,
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
