import { Suspense } from "react"
import { OnboardingEmployeeView } from "@/app/(app)/onboarding/employee/[code]/_components/onboarding-employee-view"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "オンボーディング" }

type Props = {
  params: Promise<{ code: string }>
}

// 社員別オンボーディング画面（/onboarding/employee/:code）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OnboardingEmployeePage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`社員別: ${params.code}`}
        actions={<BackButton href="/onboarding" label="オンボーディングに戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={2} rowClassName="h-48 w-full" />}>
        <OnboardingEmployeeView code={params.code} />
      </Suspense>
    </div>
  )
}
