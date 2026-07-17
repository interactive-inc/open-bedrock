import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BusinessTripAdminFilterForm } from "@/app/(app)/organization/business-trips/_components/business-trip-admin-filter-form"
import { BusinessTripAdminTable } from "@/app/(app)/organization/business-trips/_components/business-trip-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getBusinessTripAdminList,
  type BusinessTripAdminFilter,
} from "@/lib/api/get-business-trip-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canManageBusinessTrips } from "@/lib/business-trip/can-manage-business-trips"
import { canViewAllBusinessTrips } from "@/lib/business-trip/can-view-all-business-trips"

export const metadata = { title: "出張申請管理" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

// 全社の出張申請を横断で確認する画面。business_trip:read:all を持つロールのみ表示できる。
export default async function AdminBusinessTripsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllBusinessTrips(currentUser.permissions) === false) {
    notFound()
  }

  const canManage = canManageBusinessTrips(currentUser.permissions)

  const params = await props.searchParams

  const status = toSingleValue(params.status)

  const employeeIdRaw = toSingleValue(params.employee_id)

  const employeeId = toEmployeeId(employeeIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: BusinessTripAdminFilter = {
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
        title="出張申請管理"
        description="全社の出張申請を横断で確認します。"
        breadcrumbs={[
          { label: "出張", href: "/organization/business-trips" },
          { label: "出張申請管理" },
        ]}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/organization/business-trips" />}
          >
            自分の申請
          </Button>
        }
      />

      <BusinessTripAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <BusinessTripAdminSection
          filter={filter}
          offset={offset}
          extraParams={extraParams}
          canManage={canManage}
        />
      </Suspense>
    </div>
  )
}

async function BusinessTripAdminSection(props: {
  filter: BusinessTripAdminFilter
  offset: number
  extraParams: Record<string, string | undefined>
  canManage: boolean
}) {
  const result = await getBusinessTripAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="出張申請一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <BusinessTripAdminTable rows={result.data} total={result.total} canManage={props.canManage} />

      <TablePagination
        pathname="/organization/business-trips"
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
