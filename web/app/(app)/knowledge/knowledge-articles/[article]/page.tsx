import { notFound } from "next/navigation"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getKnowledgeDetail } from "@/lib/api/get-knowledge-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "ナレッジ詳細" }

type Props = {
  params: Promise<{ article: string }>
}

/** id 文字列を正の整数へ変換する。無効なら null。 */
function toKnowledgeId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/**
 * /knowledge/:id 記事詳細画面。RSC で 1 件取得し、本文（Markdown 原文）を表示する。
 * 無効な id や取得失敗・該当なしは notFound。
 */
export default async function KnowledgeDetailPage(props: Props) {
  const params = await props.params

  const knowledgeId = toKnowledgeId(params.article)

  if (knowledgeId === null) {
    notFound()
  }

  const article = await getKnowledgeDetail(knowledgeId)

  if (article instanceof Error) {
    handleDetailError(article)
  }

  const tags = toTags(article.tags)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={article.title}
        actions={<BackButton href="/knowledge/knowledge-articles" label="一覧に戻る" />}
      />

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="gap-0">
        <article className="whitespace-pre-wrap p-6 text-sm leading-relaxed">
          {article.body_md}
        </article>
      </Card>
    </div>
  )
}

/** カンマ区切りの tags 文字列を配列へ。値が無い場合は空配列。 */
function toTags(rawTags: string | null): ReadonlyArray<string> {
  if (rawTags === null) {
    return []
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
}
