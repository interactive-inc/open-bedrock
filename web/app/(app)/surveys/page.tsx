import Link from "next/link"
import { Suspense } from "react"
import { SurveyListTable } from "@/app/(app)/surveys/survey-list-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "サーベイ" }

// アンケート一覧画面 (/surveys)。
// 一覧取得は非同期 RSC を Suspense 境界に包み、取得中は Skeleton を出す。
export default function SurveysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">サーベイ</h1>

        <Button variant="outline" render={<Link href="/surveys/manage" />}>
          管理
        </Button>
      </div>

      <Suspense fallback={<SurveyListSkeleton />}>
        <SurveyListTable />
      </Suspense>
    </div>
  )
}

function SurveyListSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-3">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
