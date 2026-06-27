import Link from "next/link"
import { Suspense } from "react"
import { SurveyListTable } from "@/app/(app)/surveys/_components/survey-list-table"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "サーベイ" }

// アンケート一覧画面 (/surveys)。
// 一覧取得は非同期 RSC を Suspense 境界に包み、取得中は Skeleton を出す。
export default function SurveysPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="サーベイ"
        description="配信中のアンケートに回答します。"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/surveys/manage" />}>
            管理
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-14 w-full" />}>
        <SurveyListTable />
      </Suspense>
    </div>
  )
}
