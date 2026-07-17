import { Suspense } from "react"
import { MyTasksList } from "@/app/(app)/organization/onboarding-assignments/_components/my-tasks-list"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "自分のオンボーディング" }

// 自分のオンボーディングタスク一覧画面（/onboarding/me）。
export default function OnboardingMePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="自分のオンボーディングタスク"
        description="自分に割り当てられた未完了タスクを確認します。"
      />

      <Card>
        <CardHeader>
          <CardTitle>タスク</CardTitle>

          <CardDescription>未完了のタスクは完了にできます</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <MyTasksList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
