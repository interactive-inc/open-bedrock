import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getKnowledgeList } from "@/lib/api/get-knowledge-list"

type Props = {
  q: string | null
  category: string | null
}

// 検索条件で GET /knowledge を認証付きに取得し、記事カード一覧を描画する非同期 RSC。
// 各カードは記事詳細 /knowledge/:id へのリンク。
export async function KnowledgeResultList(props: Props) {
  const articles = await getKnowledgeList({
    q: props.q,
    category: props.category,
  })

  if (articles instanceof Error) {
    return <FetchError message="ナレッジの取得に失敗しました" />
  }

  if (articles.length === 0) {
    return <EmptyState title="該当する記事がありません" />
  }

  return (
    <div className="flex flex-col gap-3">
      {articles.map((article) => (
        <Card key={article.id} className="p-0 gap-0">
          <Link
            href={`/knowledge/${article.id}`}
            className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{article.category}</Badge>

              <span className="text-base font-medium">{article.title}</span>
            </div>

            <p className="line-clamp-2 text-sm text-muted-foreground">{article.snippet}</p>
          </Link>
        </Card>
      ))}
    </div>
  )
}
