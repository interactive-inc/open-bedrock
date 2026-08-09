import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  recipientAccountId: z.number(),
  sourceDomain: z.string(),
  sourceId: z.number().nullable(),
  kind: z.string().min(1),
  title: z.string(),
  body: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

export type StoredNotification = Readonly<{
  id: number
  recipientAccountId: number
  sourceDomain: string
  sourceId: number | null
  kind: string
  title: string
  body: string | null
  isRead: number
  createdAt: string
}>

/** Account 宛ての汎用通知エンベロープ。業務上の受信者解決と種別定義は上位層が担う。 */
export class Notification implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly recipientAccountId!: Props["recipientAccountId"]

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

  /** 新規作成する通知を組み立てる。id は未採番、初期状態は未読。 */
  static create(props: {
    recipientAccountId: number
    kind: string
    title: string
    body: string | null
    sourceDomain: string
    sourceId: number | null
    createdAt: string
  }): Notification {
    return new Notification({
      id: null,
      recipientAccountId: props.recipientAccountId,
      sourceDomain: props.sourceDomain,
      sourceId: props.sourceId,
      kind: props.kind,
      title: props.title,
      body: props.body,
      isRead: false,
      createdAt: props.createdAt,
    })
  }

  /** 永続化表現から復元する。DB や ORM の型には依存しない。 */
  static restore(row: StoredNotification): Notification {
    return new Notification({
      id: row.id,
      recipientAccountId: row.recipientAccountId,
      sourceDomain: row.sourceDomain,
      sourceId: row.sourceId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      isRead: row.isRead !== 0,
      createdAt: row.createdAt,
    })
  }

  markRead(): Notification {
    return new Notification({ ...this.props, isRead: true })
  }
}
