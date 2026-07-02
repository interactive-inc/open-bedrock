import { formatDateTime } from "@/lib/format-datetime"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getThanksList } from "@/lib/api/get-thanks-list"

// 感謝のタイムラインをサーバ側 fetch してカード描画する非同期 RSC。
// 全従業員に公開された新着順の一覧を送り主・受け手・メッセージで並べる。
export async function ThanksList() {
  const thanksList = await getThanksList()

  if (thanksList instanceof Error) {
    return <FetchError message="感謝の取得に失敗しました" />
  }

  if (thanksList.length === 0) {
    return <EmptyState title="まだ感謝がありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      {thanksList.map((thanks) => (
        <Card key={thanks.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{thanks.sender_name}</span>
              <span className="text-sm font-normal text-muted-foreground">→</span>
              <span>{thanks.recipient_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatDateTime(thanks.created_at)}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{thanks.message}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
