import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ShiftSwapAdminFilterForm } from "@/app/(app)/organization/shift-swaps/_components/shift-swap-admin-filter-form"
import { ShiftSwapAdminTable } from "@/app/(app)/organization/shift-swaps/_components/shift-swap-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { PAGE_SIZE_OPTIONS, TablePagination, parsePageSize } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import {
  getShiftSwapAdminList,
  type ShiftSwapAdminFilter,
  type ShiftSwapAdminSort,
} from "@/lib/api/get-shift-swap-admin-list"
import { canViewAllShiftSwaps } from "@/lib/shift/can-view-all-shift-swaps"

export const metadata = { title: "シフト交代管理" }

const SORT_VALUES: ReadonlyArray<ShiftSwapAdminSort> = [
  "date_desc",
  "date_asc",
  "id_desc",
  "id_asc",
]

const STATUS_VALUES: ReadonlyArray<string> = ["pending", "approved", "rejected"]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

export default async function AdminShiftSwapsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllShiftSwaps(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const statusRaw = toSingleValue(params.status)

  const status = statusRaw !== null && STATUS_VALUES.includes(statusRaw) ? statusRaw : null

  const requesterIdRaw = toSingleValue(params.requester_id)

  const targetIdRaw = toSingleValue(params.target_id)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(toSingleValue(params.sort))

  const filter: ShiftSwapAdminFilter = {
    status: status,
    requesterId: toPositiveInt(requesterIdRaw),
    targetId: toPositiveInt(targetIdRaw),
    from: from,
    to: to,
  }

  const suspenseKey = [
    filter.status ?? "",
    filter.requesterId ?? "",
    filter.targetId ?? "",
    filter.from ?? "",
    filter.to ?? "",
    sort,
    page,
  ].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    requester_id: filter.requesterId !== null ? String(filter.requesterId) : undefined,
    target_id: filter.targetId !== null ? String(filter.targetId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフト交代管理"
        description="全社のシフト交代申請を横断で確認します。"
        breadcrumbs={[{ label: "シフト", href: "/my/shifts" }, { label: "交代管理" }]}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/my/shifts" />}>
            自分のシフトへ
          </Button>
        }
      />

      <ShiftSwapAdminFilterForm
        statusValue={filter.status ?? ""}
        requesterIdValue={requesterIdRaw ?? ""}
        targetIdValue={targetIdRaw ?? ""}
        fromValue={filter.from ?? ""}
        toValue={filter.to ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <ShiftSwapAdminSection
          filter={filter}
          offset={offset}
          pageSize={pageSize}
          sort={sort}
          extraParams={extraParams}
        />
      </Suspense>
    </div>
  )
}

async function ShiftSwapAdminSection(props: {
  filter: ShiftSwapAdminFilter
  offset: number
  pageSize: number
  sort: ShiftSwapAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getShiftSwapAdminList(props.filter, {
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="シフト交代申請一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "date_desc" ? undefined : props.sort,
    size: String(props.pageSize),
  }

  return (
    <div className="flex flex-col gap-4">
      <ShiftSwapAdminTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/organization/shift-swaps"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={paginationExtraParams}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
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

function toSort(raw: string | null): ShiftSwapAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as ShiftSwapAdminSort
  }

  return "date_desc"
}
