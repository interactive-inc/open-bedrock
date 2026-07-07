import Link from "next/link"
import { FetchError } from "@/components/fetch-error"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getMeetingList } from "@/lib/api/get-meeting-list"

const PAGE_SIZE = 20

type Props = {
  offset: number
}

// GET /meetings を認証付きで取得し、会議体カード一覧を描画する非同期 RSC。
// 各カードは詳細 /meetings/:code へのリンク。
export async function MeetingList(props: Props) {
  const result = await getMeetingList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="会議体の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="会議体はまだ登録されていません"
        description="会議体を登録すると、議事録を記録できます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {result.data.map((meeting) => (
          <Card key={meeting.code} className="p-0 gap-0">
            <Link
              href={`/meetings/${meeting.code}`}
              className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {meeting.status === "archived" ? (
                  <Badge variant="outline">アーカイブ</Badge>
                ) : (
                  <Badge variant="secondary">{meeting.cadence ?? "随時"}</Badge>
                )}

                <span className="text-base font-medium">{meeting.name}</span>

                <span className="text-sm text-muted-foreground">{meeting.code}</span>
              </div>

              {meeting.description === null ? null : (
                <p className="line-clamp-2 text-sm text-muted-foreground">{meeting.description}</p>
              )}
            </Link>
          </Card>
        ))}
      </div>

      <TablePagination
        pathname="/meetings"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
