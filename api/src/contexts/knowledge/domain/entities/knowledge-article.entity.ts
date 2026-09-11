import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { KnowledgeArticleRow } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  bodyMd: z.string(),
  authorId: zEmployeeId,
  createdAt: z.string(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(["active", "withdrawn"]),
})

type Props = z.infer<typeof zProps>

/** ナレッジ記事。id は新規作成時 null、DB 採番後に確定する。 */
export class KnowledgeArticle implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly category!: Props["category"]

  readonly tags!: Props["tags"]

  readonly bodyMd!: Props["bodyMd"]

  readonly authorId!: Props["authorId"]

  readonly createdAt!: Props["createdAt"]

  readonly revision!: Props["revision"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    this.props = Object.freeze(zProps.parse(props))

    Object.assign(this, this.props)

    Object.freeze(this)
  }

  /** 新規記事を組み立てる。id は未採番のため null。 */
  static create(props: {
    title: string
    category: string
    tags: string | null
    bodyMd: string
    authorId: EmployeeId
    createdAt: string
  }): KnowledgeArticle {
    return new KnowledgeArticle({
      id: null,
      revision: 1,
      status: "active",
      title: props.title,
      category: props.category,
      tags: props.tags,
      bodyMd: props.bodyMd,
      authorId: props.authorId,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: KnowledgeArticleRow): KnowledgeArticle {
    return new KnowledgeArticle({
      id: row.id,
      revision: row.revision,
      status: row.status,
      title: row.title,
      category: row.category,
      tags: row.tags,
      bodyMd: row.bodyMd,
      authorId: row.authorId,
      createdAt: row.createdAt,
    })
  }

  /** 表題・カテゴリ・タグ・本文を更新した新しい記事を返す。 */
  withContent(props: {
    title: string
    category: string
    tags: string | null
    bodyMd: string
  }): KnowledgeArticle {
    if (this.status !== "active") throw new Error("withdrawn knowledge cannot be edited")
    return new KnowledgeArticle({
      ...this.props,
      revision: this.revision + 1,
      title: props.title,
      category: props.category,
      tags: props.tags,
      bodyMd: props.bodyMd,
    })
  }

  /** 本文を消去せず、通常の参照対象から取り下げる。 */
  withdraw(): KnowledgeArticle {
    if (this.status !== "active") throw new Error("knowledge is already withdrawn")
    return new KnowledgeArticle({ ...this.props, revision: this.revision + 1, status: "withdrawn" })
  }

  static restore(snapshot: unknown): KnowledgeArticle {
    return new KnowledgeArticle(zProps.parse(snapshot))
  }

  toJSON(): Props {
    return this.props
  }
}
