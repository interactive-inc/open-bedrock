import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getKnowledgeDetail } from "@/lib/api/get-knowledge-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "ナレッジ詳細" }

type Props = {
  params: Promise<{ id: string }>
}

// id 文字列を正の整数へ変換する。無効なら null。
function toKnowledgeId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

// /knowledge/:id 記事詳細画面。RSC で 1 件取得し、本文（Markdown 原文）を表示する。
// 無効な id や取得失敗・該当なしは notFound。
export default async function KnowledgeDetailPage(props: Props) {
  const params = await props.params

  const knowledgeId = toKnowledgeId(params.id)

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{article.category}</Badge>

            <h1 className="text-2xl font-semibold">{article.title}</h1>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <Button variant="outline" render={<Link href="/knowledge" />}>
          一覧へ戻る
        </Button>
      </div>

      <Card className="p-0 gap-0">
        <article className="whitespace-pre-wrap p-6 text-sm leading-relaxed">
          {article.body_md}
        </article>
      </Card>
    </div>
  )
}

// カンマ区切りの tags 文字列を配列へ。値が無い場合は空配列。
function toTags(rawTags: string | null): ReadonlyArray<string> {
  if (rawTags === null) {
    return []
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
}
