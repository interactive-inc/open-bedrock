import { notFound } from "next/navigation"
import { ReviewCycleCreateForm } from "@/app/(app)/review/_components/review-cycle-create-form"
import { ReviewResultsSearchForm } from "@/app/(app)/review/_components/review-results-search-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

export const metadata = { title: "評価の管理" }

/**
 * 評価の管理（特権ロールのみ）。サイクル作成と結果検索の2機能を分離して提供する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ReviewManagePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="評価の管理"
        description="評価サイクルの作成と、評価結果の横断検索を行います。"
        actions={<BackButton href="/review" label="評価に戻る" />}
      />

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
          <CardTitle>評価結果を検索</CardTitle>
        </CardHeader>

        <CardContent>
          <ReviewResultsSearchForm />
        </CardContent>
      </Card>
    </div>
  )
}
