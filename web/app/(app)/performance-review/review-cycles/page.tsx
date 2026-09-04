import { notFound } from "next/navigation"
import { ReviewCycleCreateForm } from "@/app/(app)/my/reviews/_components/review-cycle-create-form"
import { ReviewDiscloseForm } from "@/app/(app)/my/reviews/_components/review-disclose-form"
import { ReviewFormsBulkCreateForm } from "@/app/(app)/my/reviews/_components/review-forms-bulk-create-form"
import { ReviewResultsSearchForm } from "@/app/(app)/my/reviews/_components/review-results-search-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getReviewCycles } from "@/lib/api/get-review-cycles"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

export const metadata = { title: "評価サイクル" }

/**
 * 評価サイクル（特権ロールのみ）。サイクル作成と結果検索の2機能を分離して提供する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ReviewManagePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.permissions) === false) {
    notFound()
  }

  const cycles = await getReviewCycles()

  const cycleList = cycles instanceof Error ? [] : cycles

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="評価サイクル">
        <BackButton href="/my/reviews" label="評価に戻る" />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>評価サイクルを作成</CardTitle>
        </CardHeader>

        <CardContent>
          <ReviewCycleCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評価フォームを一括作成（360度評価）</CardTitle>
        </CardHeader>

        <CardContent>
          <ReviewFormsBulkCreateForm cycles={cycleList} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評価結果を開示</CardTitle>
        </CardHeader>

        <CardContent>
          <ReviewDiscloseForm cycles={cycleList} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評価結果を検索</CardTitle>
        </CardHeader>

        <CardContent>
          <ReviewResultsSearchForm />
        </CardContent>
      </Card>
    </div>
  )
}
