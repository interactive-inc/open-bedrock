import Link from "next/link"
import { getKnowledgeHistory } from "@/lib/api/get-knowledge-history"
import { KnowledgeDetailActions } from "@/app/(app)/knowledge/knowledge-articles/[article]/_components/knowledge-detail-actions"
import { getMe } from "@/lib/api/get-me"
import { notFound } from "next/navigation"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { getKnowledgeDetail } from "@/lib/api/get-knowledge-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "ナレッジ詳細" }

type Props = {
  params: Promise<{ article: string }>
  searchParams: Promise<{ historyOffset?: string }>
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

  const search = await props.searchParams
  const parsedOffset = Number(search.historyOffset ?? "0")
  const offset =
    Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? Math.min(parsedOffset, 100_000) : 0
  const [article, viewer, history] = await Promise.all([
    getKnowledgeDetail(knowledgeId),
    getMe(),
    getKnowledgeHistory(knowledgeId, offset),
  ])

  if (article instanceof Error) {
    handleDetailError(article)
  }

  if (history instanceof Error) handleDetailError(history)
  const tags = toTags(article.tags)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={article.title}>
        {article.status === "active" && viewer.id === article.author_id ? (
          <KnowledgeDetailActions article={article} />
        ) : null}
        <BackButton href="/knowledge/knowledge-articles" label="一覧に戻る" />
      </PageHeader>

      <p className="text-sm text-muted-foreground">
        第{article.revision}版 · {article.status === "withdrawn" ? "取下げ済み" : "公開中"}
      </p>
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
        <article className="whitespace-pre-wrap p-8 text-sm leading-relaxed">
          {article.body_md}
        </article>
      </Card>
      <section aria-labelledby="knowledge-history-heading" className="flex flex-col gap-4">
        <h2 id="knowledge-history-heading" className="text-lg font-semibold">
          改訂履歴（{history.total}件）
        </h2>
        {history.data.map((entry) => (
          <Card key={entry.revision}>
            <CardHeader>
              <CardTitle>
                第{entry.revision}版 · {entry.article.title}
              </CardTitle>
              <CardDescription>
                {entry.article.status === "withdrawn" ? "取下げ" : "本文を記録"} · 記録日時{" "}
                <time dateTime={new Date(entry.recorded_at).toISOString()}>
                  {new Date(entry.recorded_at).toISOString()}
                </time>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>{entry.reason}</p>
              <p className="text-sm text-muted-foreground">
                {entry.source === "existing_record"
                  ? "移行時の保存記録です。当時の編集者と改訂日時は不明です。"
                  : `記録したアカウント: ${entry.actor_account_id}`}
              </p>
              <p className="whitespace-pre-wrap">{entry.article.body_md}</p>
            </CardContent>
          </Card>
        ))}
        {history.data.length === 0 ? <p>この範囲の改訂履歴はありません。</p> : null}
        <nav aria-label="改訂履歴のページ" className="flex gap-4">
          {offset > 0 ? (
            <Link href={`?historyOffset=${Math.max(0, offset - 20)}#knowledge-history-heading`}>
              新しい履歴
            </Link>
          ) : null}
          {offset + 20 < history.total ? (
            <Link href={`?historyOffset=${offset + 20}#knowledge-history-heading`}>古い履歴</Link>
          ) : null}
        </nav>
      </section>
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
