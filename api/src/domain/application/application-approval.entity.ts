import type { ApplicationApprovalRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  applicationId: z.number(),
  approverId: z.number(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 申請への承認/却下アクションの記録。Application 集約の内部エンティティ。 */
export class ApplicationApproval implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly applicationId!: Props["applicationId"]

  readonly approverId!: Props["approverId"]

  readonly action!: Props["action"]

  readonly comment!: Props["comment"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する承認記録を組み立てる。id は未採番。 */
  static create(props: {
    applicationId: number
    approverId: number
    action: Props["action"]
    comment: string | null
    createdAt: string
  }): ApplicationApproval {
    return new ApplicationApproval({
      id: null,
      applicationId: props.applicationId,
      approverId: props.approverId,
      action: props.action,
      comment: props.comment,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ApplicationApprovalRow): ApplicationApproval | Error {
    const action = toAction(row.action)

    if (action instanceof Error) {
      return action
    }

    return new ApplicationApproval({
      id: row.id,
      applicationId: row.applicationId,
      approverId: row.approverId,
      action: action,
      comment: row.comment,
      createdAt: row.createdAt,
    })
  }
}

function toAction(value: string): ApplicationApproval["action"] | Error {
  if (value === "approve") {
    return "approve"
  }

  if (value === "reject") {
    return "reject"
  }

  return new Error("application_approvals row action is invalid")
}
