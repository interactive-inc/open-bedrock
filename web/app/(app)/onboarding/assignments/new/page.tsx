import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AssignFormSection } from "@/app/(app)/onboarding/_components/assign-form-section"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "オンボーディング割当の作成" }

/**
 * 社員にオンボーディングテンプレートを割り当てる新規フォーム（特権ロールのみ）。
 */
export default async function NewOnboardingAssignmentPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="割当を作成"
        description="社員コードとテンプレートを指定して割り当てます。"
        actions={<BackButton href="/onboarding" label="オンボーディングに戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <AssignFormSection />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
