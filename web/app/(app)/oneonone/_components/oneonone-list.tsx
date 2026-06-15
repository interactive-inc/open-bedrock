import { FetchError } from "@/components/fetch-error"
import { getOneOnOneList } from "@/lib/api/get-oneonone-list"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// 1on1 履歴をサーバ側 fetch してカード描画する非同期 RSC。
// 自由記述が長いためテーブルでなくカードで topics / 上長メモ / ネクストアクションを並べる。
export async function OneOnOneList() {
  const oneOnOnes = await getOneOnOneList()

  if (oneOnOnes instanceof Error) {
    return <FetchError message="1on1 の取得に失敗しました" />
  }

  if (oneOnOnes.length === 0) {
    return <EmptyState title="1on1 の記録がありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      {oneOnOnes.map((oneOnOne) => (
        <Card key={oneOnOne.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{oneOnOne.member_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                上長: {oneOnOne.manager_name}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {oneOnOne.held_at.slice(0, 16)}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">トピック</span>
              <span className="whitespace-pre-wrap">{oneOnOne.topics ?? "-"}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">上長メモ</span>
              <span className="whitespace-pre-wrap">{oneOnOne.manager_note ?? "-"}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">ネクストアクション</span>
              <span className="whitespace-pre-wrap">{oneOnOne.next_action ?? "-"}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
