import { formatDateTime } from "@/lib/format-date-time"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type OneOnOneItem = {
  id: string
  held_at: string
  member_name: string
  manager_name: string
  topics: string | null
  manager_note: string | null
  next_action: string | null
}

type Props = {
  oneOnOnes: ReadonlyArray<OneOnOneItem>
}

/** 1on1 履歴をカード描画する。自由記述が長いためテーブルでなくカードで並べる。 */
export function OneOnOneList(props: Props) {
  if (props.oneOnOnes.length === 0) {
    return (
      <EmptyState
        title="1on1 の記録がありません"
        description="右上の「記録を追加」から最初の 1on1 を記録しましょう。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {props.oneOnOnes.map((oneOnOne) => (
        <Card key={oneOnOne.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{oneOnOne.member_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                上長: {oneOnOne.manager_name}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatDateTime(oneOnOne.held_at)}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
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
