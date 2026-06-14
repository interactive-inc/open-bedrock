import type { ApplicationRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  templateId: z.number(),
  applicantId: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  currentStep: z.string().nullable(),
  payload: z.unknown(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 申請（テンプレートに紐づく申請者の提出）。集約ルート。 */
export class Application implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly templateId!: Props["templateId"]

  readonly applicantId!: Props["applicantId"]

  readonly status!: Props["status"]

  readonly currentStep!: Props["currentStep"]

  readonly payload!: Props["payload"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する申請を組み立てる。id は未採番、初期状態は pending。 */
  static create(props: {
    templateId: number
    applicantId: number
    currentStep: string | null
    payload: unknown
    createdAt: string
  }): Application {
    return new Application({
      id: null,
      templateId: props.templateId,
      applicantId: props.applicantId,
      status: "pending",
      currentStep: props.currentStep,
      payload: props.payload,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ApplicationRow): Application | Error {
    const status = toStatus(row.status)

    if (status instanceof Error) {
      return status
    }

    const payload = decodePayload(row.payload)

    if (payload instanceof Error) {
      return payload
    }

    return new Application({
      id: row.id,
      templateId: row.templateId,
      applicantId: row.applicantId,
      status: status,
      currentStep: row.currentStep,
      payload: payload,
      createdAt: row.createdAt,
    })
  }

  withPayload(payload: Props["payload"]) {
    return new Application({ ...this.props, payload })
  }
}

function toStatus(value: string): Application["status"] | Error {
  if (value === "pending") {
    return "pending"
  }

  if (value === "approved") {
    return "approved"
  }

  if (value === "rejected") {
    return "rejected"
  }

  return new Error("applications row status is invalid")
}

function decodePayload(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return new Error("applications row payload is not valid JSON")
  }
}
