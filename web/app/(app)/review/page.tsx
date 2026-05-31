import { Suspense } from "react"
import { MyReviewForms } from "@/app/(app)/review/my-review-forms"
import { ReviewCycleCreateForm } from "@/app/(app)/review/review-cycle-create-form"
import { ReviewCycleList } from "@/app/(app)/review/review-cycle-list"
import { ReviewResultsSearchForm } from "@/app/(app)/review/review-results-search-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { getMyReviewForms } from "@/lib/api/get-my-review-forms"
import { getReviewCycles } from "@/lib/api/get-review-cycles"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

// 評価サイクル画面。サイクル一覧と自分の評価フォームを RSC で取得して表示する。
// 特権ロールにはサイクル作成・結果検索フォームを併設する。
export default async function ReviewPage() {
  const currentUser = await getMe()

  const canAdminister = currentUser instanceof Error ? false : canAdministerCycle(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">評価</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">評価サイクル</h2>

        <Suspense fallback={<ReviewSkeleton />}>
          <ReviewCycles canAdminister={canAdminister} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の評価フォーム</h2>

        <Suspense fallback={<ReviewSkeleton />}>
          <MyForms />
        </Suspense>
      </section>

      {canAdminister ? (
        <Card>
          <CardHeader>
            <CardTitle>評価サイクルを作成</CardTitle>
          </CardHeader>

          <CardContent>
            <ReviewCycleCreateForm />
          </CardContent>
        </Card>
      ) : null}

      {canAdminister ? (
        <Card>
          <CardHeader>
            <CardTitle>評価結果を検索</CardTitle>
          </CardHeader>

          <CardContent>
            <ReviewResultsSearchForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

type ReviewCyclesProps = {
  canAdminister: boolean
}

// /review-cycles を認証付きで取得してサイクル一覧を描画する非同期 RSC。
async function ReviewCycles(props: ReviewCyclesProps) {
  const cycles = await getReviewCycles()

  if (cycles instanceof Error) {
    return <p className="text-sm text-destructive">評価サイクル一覧の取得に失敗しました</p>
  }

  return <ReviewCycleList cycles={cycles} canAdminister={props.canAdminister} />
}

// /review-forms/me を認証付きで取得して自分の評価フォームを描画する非同期 RSC。
async function MyForms() {
  const forms = await getMyReviewForms()

  if (forms instanceof Error) {
    return <p className="text-sm text-destructive">評価フォームの取得に失敗しました</p>
  }

  return <MyReviewForms forms={forms} />
}

function ReviewSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  )
}
