import { getCareerPostings } from "@/lib/api/get-career-postings"
import { CareerPostingApplyForm } from "@/app/(app)/career/career-posting-apply-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// 募集中の社内公募一覧をサーバ取得してカードで描画する非同期 RSC。
// 各カードに応募フォームを内包する。
export async function CareerPostingsSection() {
  const postings = await getCareerPostings()

  if (postings instanceof Error) {
    return <p className="text-sm text-destructive">社内公募の取得に失敗しました</p>
  }

  if (postings.length === 0) {
    return <p className="text-sm text-muted-foreground">現在募集中の社内公募はありません</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {postings.map((posting) => (
        <Card key={posting.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{posting.title}</CardTitle>

              <Badge variant="secondary">募集中</Badge>
            </div>

            <CardDescription>{posting.dept_name ?? "部署未設定"}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">必要スキル</span>

              <span className="text-sm">{posting.required_skills ?? "指定なし"}</span>
            </div>

            <CareerPostingApplyForm postingId={posting.id} postingTitle={posting.title} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
