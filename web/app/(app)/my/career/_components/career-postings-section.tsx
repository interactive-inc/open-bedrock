import { EmptyState } from "@/components/empty-state"
import { CardLink } from "@/components/card-link"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { getCareerPostings } from "@/lib/api/get-career-postings"

type Props = {
  canManage: boolean
}

/**
 * 社内公募一覧をサーバ取得してカードで描画する非同期 RSC。
 * 各カードは詳細ページ /career/postings/[id] へのリンクで、応募は詳細ページで行う。
 * 管理ロールには締切のものも含めて表示する。
 */
export async function CareerPostingsSection(props: Props) {
  const postings = await getCareerPostings()

  if (postings instanceof Error) {
    return <FetchError message="社内公募の取得に失敗しました" />
  }

  const visible = props.canManage ? postings : postings.filter((row) => row.status !== "closed")

  if (visible.length === 0) {
    return <EmptyState title="現在募集中の社内公募はありません" />
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {visible.map((posting) => (
        <CardLink
          key={posting.id ?? posting.title}
          href={
            posting.id !== null
              ? `/organization/job-postings/${posting.id}`
              : "/organization/job-postings"
          }
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{posting.title}</h3>

            <Badge variant="secondary">{posting.status === "closed" ? "締切" : "募集中"}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">{posting.dept_name ?? "部署未設定"}</p>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">必要スキル</span>

            <span className="text-sm">{posting.required_skills ?? "指定なし"}</span>
          </div>
        </CardLink>
      ))}
    </div>
  )
}
