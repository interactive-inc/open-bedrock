import { Suspense } from "react"
import { OrgReportingLineView } from "@/app/(app)/org/reporting-line/[code]/_components/org-reporting-line-view"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "レポートライン" }

type Props = {
  params: Promise<{ code: string }>
}

// レポートライン画面（/org/reporting-line/:code）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OrgReportingLinePage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`レポートライン: ${params.code}`}
        actions={<BackButton href="/org" label="組織図に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-14 w-full" />}>
        <OrgReportingLineView code={params.code} />
      </Suspense>
    </div>
  )
}
