import { Suspense } from "react"
import { MyTasksList } from "@/app/(app)/onboarding/my-tasks-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// 自分のオンボーディングタスク一覧画面（/onboarding/me）。
export default function OnboardingMePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">自分のオンボーディングタスク</h1>

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
