import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CreateTemplateForm } from "@/app/(app)/onboarding/_components/create-template-form"
import { OnboardingTemplatesTable } from "@/app/(app)/onboarding/_components/onboarding-templates-table"
import { MyTasksList } from "@/app/(app)/onboarding/_components/my-tasks-list"
import { AssignFormSection } from "@/app/(app)/onboarding/_components/assign-form-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "オンボーディング" }

// オンボーディング画面。テンプレ一覧・自分のタスク・割当フォームを Suspense 境界で並べる。
// 非特権ロールは notFound で弾く（defense-in-depth）。
export default async function OnboardingPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageOnboarding(me.role)) {
    notFound()
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">オンボーディング</h1>

        <Button variant="outline" render={<Link href="/onboarding/me" />}>
          自分のタスク
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>テンプレート</CardTitle>

          <CardDescription>入社・退社のオンボーディングテンプレート</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <OnboardingTemplatesTable />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>テンプレート作成</CardTitle>

          <CardDescription>管理権限でオンボーディングテンプレートを追加する</CardDescription>
        </CardHeader>

        <CardContent>
          <CreateTemplateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>割当</CardTitle>

          <CardDescription>社員へテンプレートを割り当てる</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <AssignFormSection />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>自分のタスク</CardTitle>

          <CardDescription>あなたに割り当てられたオンボーディングタスク</CardDescription>
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
