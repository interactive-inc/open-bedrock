import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RedemptionAdminFilterForm } from "@/app/(app)/thanks/thanks-redemptions/_components/redemption-admin-filter-form"
import { RedemptionAdminTable } from "@/app/(app)/thanks/thanks-redemptions/_components/redemption-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import {
  getRedemptionAdminList,
  type RedemptionAdminFilter,
  type RedemptionAdminSort,
  type RedemptionStatus,
} from "@/lib/api/get-redemption-admin-list"
import { canViewAllRedemptions } from "@/lib/thanks/can-view-all-redemptions"

export const metadata = { title: "交換申請管理" }

const SORT_VALUES: ReadonlyArray<RedemptionAdminSort> = ["created_at_desc", "created_at_asc"]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

export default async function AdminRedemptionsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllRedemptions(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  const employeeIdRaw = toSingleValue(params.employee_id)

  const rewardIdRaw = toSingleValue(params.reward_id)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(toSingleValue(params.sort))

  const filter: RedemptionAdminFilter = {
    status: status,
    employeeId: toEmployeeId(employeeIdRaw),
    rewardId: toPositiveInt(rewardIdRaw),
    from: from,
    to: to,
  }

  const suspenseKey = [
    filter.status ?? "",
    filter.employeeId ?? "",
    filter.rewardId ?? "",
    filter.from ?? "",
    filter.to ?? "",
    sort,
    page,
  ].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
    reward_id: filter.rewardId !== null ? String(filter.rewardId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="交換申請管理"
        description="全社のサンクス交換申請を横断で確認します。"
        breadcrumbs={[{ label: "感謝", href: "/thanks/thanks" }, { label: "交換申請管理" }]}
        actions={
          currentUser.permissions.includes("thanks_reward:manage") ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/thanks/rewards/manage" />}
            >
              景品の管理
            </Button>
          ) : null
        }
      />

      <RedemptionAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
        rewardIdValue={rewardIdRaw ?? ""}
        fromValue={filter.from ?? ""}
        toValue={filter.to ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <RedemptionAdminSection
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

async function RedemptionAdminSection(props: {
  filter: RedemptionAdminFilter
  offset: number
  pageSize: number
  sort: RedemptionAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getRedemptionAdminList(props.filter, {
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="交換申請一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "created_at_desc" ? undefined : props.sort,
    size: String(props.pageSize),
  }

  return (
    <div className="flex flex-col gap-4">
      <RedemptionAdminTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/thanks/thanks-redemptions"
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

function toStatus(value: string | null): RedemptionStatus | null {
  if (value === "pending" || value === "rejected" || value === "fulfilled") {
    return value
  }

  return null
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

function toEmployeeId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}

function toSort(raw: string | null): RedemptionAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as RedemptionAdminSort
  }

  return "created_at_desc"
}
