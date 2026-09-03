import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { OnboardingTemplatesTable } from "@/app/(app)/onboarding/onboarding-assignments/_components/onboarding-templates-table"
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

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="テンプレート"
        actions={
          <>
            <BackButton href="/onboarding/onboarding-assignments" label="オンボーディングに戻る" />

            <Button
              nativeButton={false}
              render={<Link href="/onboarding/onboarding-templates/new" />}
            >
              <Plus />
              新規テンプレート
            </Button>
          </>
        }
      />

      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="w-full" />}>
            <OnboardingTemplatesTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
