import type { KnowledgeArticleRow } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  bodyMd: z.string(),
  authorId: z.number(),
  createdAt: z.string(),
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

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規記事を組み立てる。id は未採番のため null。 */
  static create(props: {
    title: string
    category: string
    tags: string | null
    bodyMd: string
    authorId: number
    createdAt: string
  }): KnowledgeArticle {
    return new KnowledgeArticle({
      id: null,
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
    return new KnowledgeArticle({
      ...this.props,
      title: props.title,
      category: props.category,
      tags: props.tags,
      bodyMd: props.bodyMd,
    })
  }
}
