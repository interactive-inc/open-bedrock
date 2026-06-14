import type { CareerApplicationRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  postingId: z.number(),
  applicantId: z.number(),
  message: z.string().nullable(),
  status: z.enum(["applied", "accepted", "rejected"]),
})

type Props = z.infer<typeof zProps>

// 公募への応募。集約ルート。
export class CareerApplication implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly postingId!: Props["postingId"]

  readonly applicantId!: Props["applicantId"]

  readonly message!: Props["message"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の応募を組み立てる。id は未採番、初期状態は applied。
  static create(props: {
    postingId: number
    applicantId: number
    message: string | null
  }): CareerApplication {
    return new CareerApplication({
      id: null,
      postingId: props.postingId,
      applicantId: props.applicantId,
      message: props.message,
      status: "applied",
    })
  }

  // 応募メッセージを差し替えた新しい応募を返す。
  withMessage(message: string | null): CareerApplication {
    return new CareerApplication({ ...this.props, message })
  }

  // 永続化された行から復元する。
  static fromRow(row: CareerApplicationRow): CareerApplication {
    return new CareerApplication({
      id: row.id,
      postingId: row.postingId,
      applicantId: row.applicantId,
      message: row.message,
      status: toApplicationStatus(row.status),
    })
  }
}

function toApplicationStatus(status: string): CareerApplication["status"] {
  if (status === "accepted") {
    return "accepted"
  }

  if (status === "rejected") {
    return "rejected"
  }

  return "applied"
}
