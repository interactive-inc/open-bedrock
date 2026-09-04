import { Suspense } from "react"
import { OnboardingEmployeeView } from "@/app/(app)/company/employees/[employee]/onboarding/_components/onboarding-employee-view"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "オンボーディング" }

type Props = {
  params: Promise<{ employee: string }>
}

/**
 * 社員別オンボーディング画面（/onboarding/employee/:code）。
 * 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
 */
export default async function OnboardingEmployeePage(props: Props) {
  await requirePermission("onboarding:view:all")

  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`社員別: ${params.employee}`}>
        <BackButton href="/onboarding/onboarding-assignments" label="オンボーディングに戻る" />
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={2} rowClassName="h-48 w-full" />}>
        <OnboardingEmployeeView code={params.employee} />
      </Suspense>
    </div>
  )
}
