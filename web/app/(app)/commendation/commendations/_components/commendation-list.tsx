import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { TablePagination } from "@/components/table-pagination"
import { Card } from "@/components/ui/card"
import { getCommendationList } from "@/lib/api/get-commendation-list"
import { CommendationDeleteButton } from "@/app/(app)/commendation/commendations/_components/commendation-delete-button"

const PAGE_SIZE = 20

type Props = {
  offset: number
  canManage: boolean
}

/** GET /commendations を認証付きで取得し、表彰カード一覧を描画する非同期 RSC。 */
export async function CommendationList(props: Props) {
  const result = await getCommendationList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="表彰の記録の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="表彰の記録はまだありません"
        description="社内の表彰を記録すると、ここに一覧で表示されます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {result.data.map((commendation) => (
          <Card key={commendation.id} className="gap-0">
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className="text-base font-medium">{commendation.title}</span>

                  <span className="text-sm text-muted-foreground">{commendation.awarded_on}</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  従業員ID {commendation.employee_id}：{commendation.reason}
                </p>
              </div>

              {props.canManage ? <CommendationDeleteButton id={commendation.id} /> : null}
            </div>
          </Card>
        ))}
      </div>

      <TablePagination
        pathname="/commendation/commendations"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
