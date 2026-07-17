import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { LifeEventAdminFilterForm } from "@/app/(app)/organization/life-events/_components/life-event-admin-filter-form"
import { LifeEventAdminTable } from "@/app/(app)/organization/life-events/_components/life-event-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getLifeEventAdminList,
  type LifeEventAdminFilter,
} from "@/lib/api/get-life-event-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canManageLifeEvents } from "@/lib/life-event/can-manage-life-events"
import { canViewAllLifeEvents } from "@/lib/life-event/can-view-all-life-events"

export const metadata = { title: "ライフイベント届管理" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

// 全社のライフイベント届を横断で確認する画面。life_event:read:all を持つロールのみ表示できる。
export default async function AdminLifeEventsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllLifeEvents(currentUser.permissions) === false) {
    notFound()
  }

  const canManage = canManageLifeEvents(currentUser.permissions)

  const params = await props.searchParams

  const status = toSingleValue(params.status)

  const employeeIdRaw = toSingleValue(params.employee_id)

  const employeeId = toEmployeeId(employeeIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: LifeEventAdminFilter = {
    status: status,
    employeeId: employeeId,
  }

  const suspenseKey = [filter.status ?? "", filter.employeeId ?? "", page].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ライフイベント届管理"
        description="全社のライフイベント届を横断で確認します。"
        breadcrumbs={[
          { label: "ライフイベント届", href: "/organization/life-events" },
          { label: "ライフイベント届管理" },
        ]}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/organization/life-events" />}
          >
            自分の届出
          </Button>
        }
      />

      <LifeEventAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <LifeEventAdminSection
          filter={filter}
          offset={offset}
          extraParams={extraParams}
          canManage={canManage}
        />
      </Suspense>
    </div>
  )
}

async function LifeEventAdminSection(props: {
  filter: LifeEventAdminFilter
  offset: number
  extraParams: Record<string, string | undefined>
  canManage: boolean
}) {
  const result = await getLifeEventAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="ライフイベント届一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <LifeEventAdminTable rows={result.data} total={result.total} canManage={props.canManage} />

      <TablePagination
        pathname="/organization/life-events"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
        extraParams={props.extraParams}
      />
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

function toEmployeeId(raw: string | null): number | null {
  if (raw === null) {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}
