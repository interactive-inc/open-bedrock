import { FetchError } from "@/components/fetch-error"
import { EmptyState } from "@/components/empty-state"
import { Card } from "@/components/ui/card"
import { getMeetingMinutesList } from "@/lib/api/get-meeting-minutes-list"

type Props = {
  code: string
}

// GET /meetings/:code/minutes を認証付きで取得し、議事録カード一覧を描画する非同期 RSC。
export async function MeetingMinutesList(props: Props) {
  const result = await getMeetingMinutesList(props.code)

  if (result instanceof Error) {
    return <FetchError message="議事録の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="議事録はまだありません"
        description="下のフォームから最初の議事録を記録できます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {result.data.map((minutes) => (
        <Card key={minutes.id} className="p-0 gap-0">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{minutes.held_on}</span>

              <span className="text-base font-medium">{minutes.title}</span>
            </div>

            {minutes.attendees === null ? null : (
              <p className="text-sm text-muted-foreground">出席者: {minutes.attendees}</p>
            )}

            <p className="line-clamp-3 whitespace-pre-wrap text-sm">{minutes.body_md}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
