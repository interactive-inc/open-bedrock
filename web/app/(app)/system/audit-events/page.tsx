import Link from "next/link"
import { Suspense } from "react"
import { AuditEventFilterForm } from "@/app/(app)/system/audit-events/_components/audit-event-filter-form"
import { AuditEventListSection } from "@/app/(app)/system/audit-events/_components/audit-event-list-section"
import { AuditExportForm } from "@/app/(app)/system/audit-events/_components/audit-export-form"
import { parseAuditListSearchParams } from "@/app/(app)/system/audit-events/_lib/audit-query"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "監査ログ" }

type Props = {
  searchParams: Promise<Record<string, string | ReadonlyArray<string> | undefined>>
}

export default async function AuditEventsPage(props: Props) {
  const currentUser = await requirePermission("audit:read")
  const rawSearchParams = await props.searchParams
  const parsed = parseAuditListSearchParams(rawSearchParams)

  if (!parsed.ok) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="監査ログ" description="重要操作と認可判断の記録を確認します。" />
        <Alert variant="destructive">
          <AlertTitle>検索条件が無効です</AlertTitle>
          <AlertDescription>
            URLの検索条件を確認してください。{" "}
            <Link href="/system/audit-events" prefetch={false}>
              監査ログへ戻る
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const canExport = currentUser.permissions.includes("audit:export")
  const suspenseKey = JSON.stringify(parsed.query)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="監査ログ"
        description="重要操作と認可判断の記録を確認します。"
        actions={canExport ? <AuditExportForm query={parsed.query} /> : undefined}
      />
      <AuditEventFilterForm query={parsed.query} />
      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <AuditEventListSection query={parsed.query} />
      </Suspense>
    </div>
  )
}
