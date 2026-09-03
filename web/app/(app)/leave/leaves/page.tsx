import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { LeaveAdminFilterForm } from "@/app/(app)/leave/leaves/_components/leave-admin-filter-form"
import { LeaveAdminTable } from "@/app/(app)/leave/leaves/_components/leave-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import {
  getLeaveAdminList,
  type LeaveAdminFilter,
  type LeaveAdminSort,
} from "@/lib/api/get-leave-admin-list"
import { getMe } from "@/lib/api/get-me"
import type { LeaveStatus, LeaveType } from "@/lib/api/types/leave-types"
import { canViewAllLeaves } from "@/lib/leave/can-view-all-leaves"

export const metadata = { title: "休暇申請管理" }

const SORT_VALUES: ReadonlyArray<LeaveAdminSort> = [
  "created_at_desc",
  "created_at_asc",
  "start_date_desc",
  "start_date_asc",
]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

export default async function AdminLeavesPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllLeaves(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  const leaveType = toLeaveType(toSingleValue(params.leave_type))

  const applicantIdRaw = toSingleValue(params.applicant_id)

  const applicantId = toApplicantId(applicantIdRaw)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(toSingleValue(params.sort))

  const filter: LeaveAdminFilter = {
    status: status,
    applicantId: applicantId,
    leaveType: leaveType,
    from: from,
    to: to,
  }

  const suspenseKey = [
    filter.status ?? "",
    filter.applicantId ?? "",
    filter.leaveType ?? "",
    filter.from ?? "",
    filter.to ?? "",
    sort,
    page,
  ].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    leave_type: filter.leaveType ?? undefined,
    applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="休暇申請管理"
        actions={
          currentUser.permissions.includes("leave:approve") ? (
            <Button variant="secondary" nativeButton={false} render={<Link href="/inbox/leaves" />}>
              承認受信箱
            </Button>
          ) : null
        }
      />

      <LeaveAdminFilterForm
        statusValue={filter.status ?? ""}
        leaveTypeValue={filter.leaveType ?? ""}
        applicantIdValue={applicantIdRaw ?? ""}
        fromValue={filter.from ?? ""}
        toValue={filter.to ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <LeaveAdminSection
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

async function LeaveAdminSection(props: {
  filter: LeaveAdminFilter
  offset: number
  pageSize: number
  sort: LeaveAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getLeaveAdminList(props.filter, {
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="休暇申請一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "created_at_desc" ? undefined : props.sort,
    size: String(props.pageSize),
  }

  return (
    <div className="flex flex-col gap-4">
      <LeaveAdminTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/leave/leaves"
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

function toStatus(value: string | null): LeaveStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value
  }

  return null
}

const LEAVE_TYPES: ReadonlyArray<LeaveType> = [
  "annual",
  "special",
  "compensatory",
  "summer",
  "child_nursing_care",
  "prenatal_checkup",
  "menstrual",
  "caregiving_leave",
]

function toLeaveType(value: string | null): LeaveType | null {
  return LEAVE_TYPES.find((leaveType) => leaveType === value) ?? null
}

function toApplicantId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}

function toSort(raw: string | null): LeaveAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as LeaveAdminSort
  }

  return "created_at_desc"
}
