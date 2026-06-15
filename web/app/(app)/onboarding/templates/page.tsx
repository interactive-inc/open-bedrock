import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { OnboardingTemplatesTable } from "@/app/(app)/onboarding/_components/onboarding-templates-table"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "オンボーディングテンプレート" }

/**
 * オンボーディングテンプレート一覧（特権ロールのみ）。
 */
export default async function OnboardingTemplatesPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageOnboarding(me.role)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="テンプレート"
        description="入社・退社のオンボーディングテンプレートを管理します。"
        actions={
          <>
            <BackButton href="/onboarding" label="オンボーディングに戻る" />

            <Button render={<Link href="/onboarding/templates/new" />}>
              <Plus />
              新規テンプレート
            </Button>
          </>
        }
      />

      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <OnboardingTemplatesTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
