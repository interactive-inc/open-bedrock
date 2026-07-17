import { notFound } from "next/navigation"
import { CareerPostingApplyForm } from "@/app/(app)/my/career/_components/career-posting-apply-form"
import { PostingManagement } from "@/app/(app)/my/career/_components/posting-management"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getCareerPosting } from "@/lib/api/get-career-posting"
import { getCareerPostings } from "@/lib/api/get-career-postings"
import type { CareerPosting } from "@/lib/api/types/career-types"

type Props = {
  postingId: number
  canManage: boolean
}

// status は一覧 API では生 string で返るため open/closed に正規化する。
function toPostingStatus(value: string): "open" | "closed" {
  return value === "closed" ? "closed" : "open"
}

// 1 件の公募を取得する。管理ロールは詳細 API（締切も含む）、それ以外は一覧から id で絞り込む。
async function loadPosting(postingId: number, canManage: boolean): Promise<CareerPosting | Error> {
  if (canManage) {
    return getCareerPosting(postingId)
  }

  const postings = await getCareerPostings()

  if (postings instanceof Error) {
    return postings
  }

  const found = postings.find((row) => row.id === postingId)

  if (found === undefined) {
    return new Error("posting not found")
  }

  return {
    id: found.id,
    title: found.title,
    dept_id: found.dept_id,
    dept_name: found.dept_name,
    required_skills: found.required_skills,
    status: toPostingStatus(found.status),
  }
}

// 公募詳細をサーバ取得して、応募フォーム（本人）と管理操作（管理ロール）を描画する非同期 RSC。
export async function CareerPostingDetailSection(props: Props) {
  const posting = await loadPosting(props.postingId, props.canManage)

  if (posting instanceof Error) {
    if (props.canManage === false) {
      notFound()
    }

    return <FetchError message="公募の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-0 gap-0">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{posting.title}</h2>

            <Badge variant="secondary">{posting.status === "closed" ? "締切" : "募集中"}</Badge>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">部署</span>

            <span className="text-sm">{posting.dept_name ?? "部署未設定"}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">必要スキル</span>

            <span className="text-sm">{posting.required_skills ?? "指定なし"}</span>
          </div>

          {props.canManage ? <PostingManagement posting={posting} /> : null}
        </div>
      </Card>

      {posting.status === "open" && posting.id !== null ? (
        <Card className="p-0 gap-0">
          <div className="flex flex-col gap-4 p-6">
            <h3 className="text-base font-semibold">この公募に応募</h3>

            <CareerPostingApplyForm postingId={posting.id} postingTitle={posting.title} />
          </div>
        </Card>
      ) : null}
    </div>
  )
}
