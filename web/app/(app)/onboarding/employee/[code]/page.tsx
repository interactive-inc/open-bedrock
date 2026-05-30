import { Suspense } from "react"
import Link from "next/link"
import { OnboardingEmployeeView } from "@/app/(app)/onboarding/employee/[code]/onboarding-employee-view"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  params: Promise<{ code: string }>
}

// 社員別オンボーディング画面（/onboarding/employee/:code）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OnboardingEmployeePage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/onboarding" className="text-sm text-muted-foreground hover:underline">
          オンボーディングに戻る
        </Link>

        <h1 className="text-2xl font-semibold">社員別: {params.code}</h1>
      </div>

      <Suspense fallback={<OnboardingEmployeeSkeleton />}>
        <OnboardingEmployeeView code={params.code} />
      </Suspense>
    </div>
  )
}

function OnboardingEmployeeSkeleton() {
  const placeholders = [0, 1]

  return (
    <div className="flex flex-col gap-4">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-48 w-full" />
      ))}
    </div>
  )
}
