import { FetchError } from "@/components/fetch-error"
import { CardLink } from "@/components/card-link"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination/parse-page-size"
import { Badge } from "@/components/ui/badge"
import { getKnowledgeList } from "@/lib/api/get-knowledge-list"

type Props = {
  q: string | null
  category: string | null
  offset: number
  pageSize: number
}

/**
 * 検索条件で GET /knowledge-articles を認証付きに取得し、記事カード一覧を描画する非同期 RSC。
 * 各カードは記事詳細 /knowledge/:id へのリンク。
 */
export async function KnowledgeResultList(props: Props) {
  const result = await getKnowledgeList({
    q: props.q,
    category: props.category,
    limit: props.pageSize,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="ナレッジの取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="該当する記事がありません"
        description="キーワードやカテゴリを変えて検索してみてください。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {result.data.map((article) => (
          <CardLink
            key={article.id}
            href={`/knowledge/knowledge-articles/${article.id}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{article.category}</Badge>

              <span className="text-base font-medium">{article.title}</span>
            </div>

            <p className="line-clamp-2 text-sm text-muted-foreground">{article.snippet}</p>
          </CardLink>
        ))}
      </div>

      <TablePagination
        pathname="/knowledge/knowledge-articles"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{
          q: props.q ?? undefined,
          category: props.category ?? undefined,
          size: String(props.pageSize),
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
