import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AnnouncementRow } from "@/contexts/announcement/infrastructure/schema/announcement"
import { z } from "zod"

export const announcementStatusSchema = z.enum(["draft", "published", "archived"])

export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  bodyMd: z.string(),
  publishedOn: z.string().nullable(),
  authorEmployeeId: zEmployeeId,
  status: announcementStatusSchema,
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 社内アナウンス1件。公開判定や通知配信は持たず状態と本文の記録のみ。 */
export class Announcement implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly bodyMd!: Props["bodyMd"]

  readonly publishedOn!: Props["publishedOn"]

  readonly authorEmployeeId!: Props["authorEmployeeId"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規アナウンスを組み立てる。id は未採番、初期状態は draft。 */
  static create(props: {
    title: string
    bodyMd: string
    authorEmployeeId: EmployeeId
    createdAt: string
  }): Announcement {
    return new Announcement({
      id: null,
      title: props.title,
      bodyMd: props.bodyMd,
      publishedOn: null,
      authorEmployeeId: props.authorEmployeeId,
      status: "draft",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: AnnouncementRow): Announcement {
    return new Announcement({
      id: row.id,
      title: row.title,
      bodyMd: row.bodyMd,
      publishedOn: row.publishedOn,
      authorEmployeeId: row.authorEmployeeId,
      status: announcementStatusSchema.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 表題・本文を差し替えた新しいアナウンスを返す。状態は保つ。 */
  withContent(content: { title: string; bodyMd: string }): Announcement {
    return new Announcement({
      ...this.props,
      title: content.title,
      bodyMd: content.bodyMd,
    })
  }

  /** 公開状態にし、公開日を確定させたアナウンスを返す。 */
  publish(publishedOn: string): Announcement {
    return new Announcement({
      ...this.props,
      status: "published",
      publishedOn: publishedOn,
    })
  }

  /** アーカイブ状態にしたアナウンスを返す。 */
  archive(): Announcement {
    return new Announcement({
      ...this.props,
      status: "archived",
    })
  }
}
