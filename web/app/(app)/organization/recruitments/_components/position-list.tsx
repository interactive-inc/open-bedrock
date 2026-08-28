import { EmptyState } from "@/components/empty-state"
import { CardLink } from "@/components/card-link"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { getRecruitmentPositionList } from "@/lib/api/get-recruitment-position-list"

/**
 * GET /job-openings を認証付きで取得し、募集ポジションのカード一覧を描画する RSC。
 * 各カードは応募者パイプライン /recruitment/:id へのリンク。
 */
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
        <CardLink
          key={position.id}
          href={`/organization/recruitments/${position.id}`}
          className="flex items-center gap-3"
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
        </CardLink>
      ))}
    </div>
  )
}
