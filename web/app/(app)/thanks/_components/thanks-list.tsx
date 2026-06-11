import { getThanksList } from "@/lib/api/get-thanks-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// 感謝のタイムラインをサーバ側 fetch してカード描画する非同期 RSC。
// 全従業員に公開された新着順の一覧を送り主・受け手・メッセージで並べる。
export async function ThanksList() {
  const thanksList = await getThanksList()

  if (thanksList instanceof Error) {
    return <p className="text-sm text-destructive">感謝の取得に失敗しました</p>
  }

  if (thanksList.length === 0) {
    return <p className="text-sm text-muted-foreground">まだ感謝がありません</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {thanksList.map((thanks) => (
        <Card key={thanks.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span>{thanks.sender_name}</span>
              <span className="text-sm font-normal text-muted-foreground">→</span>
              <span>{thanks.recipient_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {thanks.created_at.slice(0, 16)}
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
