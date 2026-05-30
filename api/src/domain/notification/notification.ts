import type { NotificationRow } from "@/schema"
import { z } from "zod"

export const notificationKindSchema = z.enum([
  "task",
  "approval_request",
  "approval_result",
  "reminder",
  "announcement",
])

export type NotificationKind = z.infer<typeof notificationKindSchema>

const zProps = z.object({
  id: z.number().nullable(),
  recipientEmployeeId: z.number(),
  sourceDomain: z.string(),
  sourceId: z.number().nullable(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 社員宛ての通知1件。集約ルート。
export class Notification implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly recipientEmployeeId!: Props["recipientEmployeeId"]

  readonly sourceDomain!: Props["sourceDomain"]

  readonly sourceId!: Props["sourceId"]

  readonly kind!: Props["kind"]

  readonly title!: Props["title"]

  readonly body!: Props["body"]

  readonly isRead!: Props["isRead"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成する通知を組み立てる。id は未採番、初期状態は未読。
  static create(props: {
    recipientEmployeeId: number
    kind: NotificationKind
    title: string
    body: string | null
    sourceDomain: string
    sourceId: number | null
    createdAt: string
  }): Notification {
    return new Notification({
      id: null,
      recipientEmployeeId: props.recipientEmployeeId,
      sourceDomain: props.sourceDomain,
      sourceId: props.sourceId,
      kind: props.kind,
      title: props.title,
      body: props.body,
      isRead: false,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: NotificationRow): Notification {
    return new Notification({
      id: row.id,
      recipientEmployeeId: row.recipientEmployeeId,
      sourceDomain: row.sourceDomain,
      sourceId: row.sourceId,
      kind: notificationKindSchema.parse(row.kind),
      title: row.title,
      body: row.body,
      isRead: row.isRead !== 0,
      createdAt: row.createdAt,
    })
  }

  markRead() {
    return new Notification({ ...this.props, isRead: true })
  }
}
