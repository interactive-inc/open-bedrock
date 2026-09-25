import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { KnowledgeArticleRow } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { z } from "zod"

const zProps = z.object({
  id: z.string().nullable(),
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

  /**
   * 改訂履歴の本文から記事を復元する。主キーを UUID へ移す前の履歴は整数の記事 ID を含んだまま
   * 変更しないので、記録行の article_id（現在の記事の UUID）を記事 ID として使う。
   */
  static restoreRevision(snapshot: unknown, articleId: string): KnowledgeArticle | Error {
    const parsed = zProps
      .extend({ id: z.union([z.string(), z.number().int().positive()]) })
      .safeParse(snapshot)
    if (!parsed.success) return parsed.error
    if (typeof parsed.data.id === "string" && parsed.data.id !== articleId)
      return new Error("knowledge revision snapshot belongs to another article")
    return new KnowledgeArticle({ ...parsed.data, id: articleId })
  }

  toJSON(): Props {
    return this.props
  }
}
