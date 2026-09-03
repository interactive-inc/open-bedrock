import { FetchError } from "@/components/fetch-error"
import { CardLink } from "@/components/card-link"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"
import { Badge } from "@/components/ui/badge"
import { getDecisionList } from "@/lib/api/get-decision-list"

const PAGE_SIZE = 20

type Props = {
  offset: number
}

/**
 * GET /decision-records を認証付きで取得し、意思決定記録カード一覧を描画する非同期 RSC。
 * 各カードは詳細 /decisions/:id へのリンク。
 */
export async function DecisionList(props: Props) {
  const result = await getDecisionList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="意思決定記録の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="意思決定記録はまだありません"
        description="重要な意思決定を記録すると、後から背景と経緯をたどれます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {result.data.map((decision) => (
          <CardLink
            key={decision.id}
            href={`/meeting/decisions/${decision.id}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-3">
              {decision.status === "superseded" ? (
                <Badge variant="outline">置き換え済み</Badge>
              ) : (
                <Badge variant="secondary">有効</Badge>
              )}

              <span className="text-base font-medium">{decision.title}</span>

              <span className="text-sm text-muted-foreground">{decision.decided_on}</span>
            </div>

            <p className="line-clamp-2 text-sm text-muted-foreground">{decision.decision}</p>
          </CardLink>
        ))}
      </div>

      <TablePagination
        pathname="/meeting/decisions"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
