import { getCareerPostings } from "@/lib/api/get-career-postings"
import { CreatePostingForm } from "@/app/(app)/career/create-posting-form"
import { PostingManagement } from "@/app/(app)/career/posting-management"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CareerPosting } from "@/lib/api/types/career-types"

// 一覧 API は status を DB の生 string で返すため、open/closed の union に正規化する。
function toCareerPosting(row: {
  id: number | null
  title: string
  dept_id: number | null
  dept_name: string | null
  required_skills: string | null
  status: string
}): CareerPosting {
  return {
    id: row.id,
    title: row.title,
    dept_id: row.dept_id,
    dept_name: row.dept_name,
    required_skills: row.required_skills,
    status: row.status === "closed" ? "closed" : "open",
  }
}

// 管理ロール向けの社内公募管理セクション。公募の新規作成と、各公募の変更・削除を行う。
// 公開一覧（募集中）をベースに各カードへ管理操作を添える非同期 RSC。
export async function CareerPostingsAdminSection() {
  const postings = await getCareerPostings()

  if (postings instanceof Error) {
    return <p className="text-sm text-destructive">公募の取得に失敗しました</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>公募を作成</CardTitle>

          <CardDescription>新しい社内公募を登録します。</CardDescription>
        </CardHeader>

        <CardContent>
          <CreatePostingForm />
        </CardContent>
      </Card>

      {postings.length === 0 ? (
        <p className="text-sm text-muted-foreground">管理対象の公募はありません</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {postings.map(toCareerPosting).map((posting) => (
            <Card key={posting.id ?? posting.title}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{posting.title}</CardTitle>

                  <Badge variant="secondary">
                    {posting.status === "closed" ? "締切" : "募集中"}
                  </Badge>
                </div>

                <CardDescription>{posting.dept_name ?? "部署未設定"}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">必要スキル</span>

                  <span className="text-sm">{posting.required_skills ?? "指定なし"}</span>
                </div>

                <PostingManagement posting={posting} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
