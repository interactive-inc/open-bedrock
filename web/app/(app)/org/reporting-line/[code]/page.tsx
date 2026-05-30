import { Suspense } from "react"
import Link from "next/link"
import { OrgReportingLineView } from "@/app/(app)/org/reporting-line/[code]/org-reporting-line-view"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  params: Promise<{ code: string }>
}

// レポートライン画面（/org/reporting-line/:code）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OrgReportingLinePage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/org" className="text-sm text-muted-foreground hover:underline">
          組織図に戻る
        </Link>

        <h1 className="text-2xl font-semibold">レポートライン: {params.code}</h1>
      </div>

      <Suspense fallback={<OrgReportingLineSkeleton />}>
        <OrgReportingLineView code={params.code} />
      </Suspense>
    </div>
  )
}

function OrgReportingLineSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
