import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AuditLogFilterForm } from "@/app/(app)/admin/audit-logs/_components/audit-log-filter-form"
import { AuditLogListSection } from "@/app/(app)/admin/audit-logs/_components/audit-log-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import type { AuditLogFilter } from "@/lib/api/get-audit-logs"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "監査ログ" }

const PAGE_SIZE = 50

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

// 監査ログ閲覧画面。audit_log:read を持つロールのみ表示できる読み取り専用一覧。
// 権限が無いユーザーには 404 を返し、機能の存在を露出しない。
export default async function AdminAuditLogsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("audit_log:read") === false
  ) {
    notFound()
  }

  const params = await props.searchParams

  const action = toSingleValue(params.action)

  const targetType = toSingleValue(params.target_type)

  const actorAccountIdRaw = toSingleValue(params.actor_account_id)

  const actorAccountId = toPositiveInt(actorAccountIdRaw)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: AuditLogFilter = {
    actorAccountId: actorAccountId,
    action: action,
    targetType: targetType,
    from: from,
    to: to,
  }

  const extraParams: Record<string, string | undefined> = {
    action: filter.action ?? undefined,
    target_type: filter.targetType ?? undefined,
    actor_account_id: filter.actorAccountId !== null ? String(filter.actorAccountId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  const suspenseKey = [
    filter.action ?? "",
    filter.targetType ?? "",
    filter.actorAccountId ?? "",
    filter.from ?? "",
    filter.to ?? "",
    page,
  ].join(":")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="監査ログ" description="システム上の操作履歴を新しい順に確認します。" />

      <AuditLogFilterForm
        actionValue={filter.action ?? ""}
        targetTypeValue={filter.targetType ?? ""}
        actorAccountIdValue={actorAccountIdRaw ?? ""}
        fromValue={filter.from ?? ""}
        toValue={filter.to ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <AuditLogListSection
          filter={filter}
          limit={PAGE_SIZE}
          offset={offset}
          extraParams={extraParams}
        />
      </Suspense>
    </div>
  )
}

function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

function toPositiveInt(raw: string | null): number | null {
  if (raw === null) {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}
