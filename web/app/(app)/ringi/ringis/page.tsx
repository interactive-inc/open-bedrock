import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RingiAdminFilterForm } from "@/app/(app)/ringi/ringis/_components/ringi-admin-filter-form"
import { RingiAdminTable } from "@/app/(app)/ringi/ringis/_components/ringi-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getRingiAdminList,
  type RingiAdminFilter,
  type RingiAdminSort,
} from "@/lib/api/get-ringi-admin-list"
import type { RingiStatus } from "@/lib/api/types/ringi-types"
import { getMe } from "@/lib/api/get-me"
import { canViewAllRingi } from "@/lib/ringi/can-view-all-ringi"

export const metadata = { title: "稟議管理" }

const PAGE_SIZE = 20

const SORT_VALUES: ReadonlyArray<RingiAdminSort> = [
  "created_at_desc",
  "created_at_asc",
  "amount_desc",
  "amount_asc",
]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/** 全社の稟議を横断で管理する画面。ringi:read:all を持つロールのみ表示できる。 */
export default async function AdminRingiPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllRingi(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  const applicantIdRaw = toSingleValue(params.applicant_id)

  const applicantId = toApplicantId(applicantIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const sort = toSort(toSingleValue(params.sort))

  const filter: RingiAdminFilter = {
    status: status,
    applicantId: applicantId,
  }

  const suspenseKey = [filter.status ?? "", filter.applicantId ?? "", sort, page].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="稟議管理"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/inbox/ringis" />}>
            承認受信箱
          </Button>
        }
      />

      <RingiAdminFilterForm
        statusValue={filter.status ?? ""}
        applicantIdValue={applicantIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <RingiAdminSection filter={filter} offset={offset} sort={sort} extraParams={extraParams} />
      </Suspense>
    </div>
  )
}

async function RingiAdminSection(props: {
  filter: RingiAdminFilter
  offset: number
  sort: RingiAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getRingiAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="稟議一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "created_at_desc" ? undefined : props.sort,
  }

  return (
    <div className="flex flex-col gap-4">
      <RingiAdminTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/ringi/ringis"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
        extraParams={paginationExtraParams}
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

function toStatus(value: string | null): RingiStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value
  }

  return null
}

function toApplicantId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}

function toSort(raw: string | null): RingiAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as RingiAdminSort
  }

  return "created_at_desc"
}
