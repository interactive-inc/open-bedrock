import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getRecruitmentPositionList } from "@/lib/api/get-recruitment-position-list"

// GET /recruitment/positions を認証付きで取得し、募集ポジションのカード一覧を描画する RSC。
// 各カードは応募者パイプライン /recruitment/:id へのリンク。
export async function PositionList() {
  const positions = await getRecruitmentPositionList({})

  if (positions instanceof Error) {
    return <FetchError message="募集の取得に失敗しました" />
  }

  if (positions.length === 0) {
    return (
      <EmptyState
        title="募集はまだありません"
        description="募集ポジションを作成すると、応募者のパイプラインを管理できます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {positions.map((position) => (
        <Card key={position.id} className="gap-0 p-0">
          <Link
            href={`/recruitment/${position.id}`}
            className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50"
          >
            {position.status === "open" ? (
              <Badge variant="secondary">募集中</Badge>
            ) : (
              <Badge variant="outline">終了</Badge>
            )}

            <span className="text-base font-medium">{position.title}</span>

            {position.department_code === null ? null : (
              <span className="text-sm text-muted-foreground">{position.department_code}</span>
            )}
          </Link>
        </Card>
      ))}
    </div>
  )
}
