import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ExpenseAdminFilterForm } from "@/app/(app)/expense/expenses/_components/expense-admin-filter-form"
import { ExpenseAdminTable } from "@/app/(app)/expense/expenses/_components/expense-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import {
  getExpenseAdminList,
  type ExpenseAdminFilter,
  type ExpenseAdminSort,
} from "@/lib/api/get-expense-admin-list"
import type { ExpenseCategory, ExpenseStatus } from "@/lib/api/types/expense-types"
import { getMe } from "@/lib/api/get-me"
import { canViewAllExpenses } from "@/lib/expense/can-view-all-expenses"

export const metadata = { title: "経費申請管理" }

const SORT_VALUES: ReadonlyArray<ExpenseAdminSort> = [
  "created_at_desc",
  "created_at_asc",
  "amount_desc",
  "amount_asc",
]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/** 全社の経費申請を横断で管理する画面。expense:read:all を持つロールのみ表示できる。 */
export default async function AdminExpensesPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllExpenses(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  const category = toCategory(toSingleValue(params.category))

  const applicantIdRaw = toSingleValue(params.applicant_id)

  const applicantId = toApplicantId(applicantIdRaw)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(toSingleValue(params.sort))

  const filter: ExpenseAdminFilter = {
    status: status,
    applicantId: applicantId,
    category: category,
    from: from,
    to: to,
  }

  const suspenseKey = [
    filter.status ?? "",
    filter.applicantId ?? "",
    filter.category ?? "",
    filter.from ?? "",
    filter.to ?? "",
    sort,
    page,
  ].join(":")

  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    category: filter.category ?? undefined,
    applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経費申請管理"
        description="全社の経費申請を横断で確認します。承認は各申請の詳細から行います。"
        breadcrumbs={[{ label: "経費", href: "/my/expenses" }, { label: "経費申請管理" }]}
        actions={
          currentUser.permissions.includes("expense:approve") ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/inbox/expenses" />}
            >
              承認受信箱
            </Button>
          ) : null
        }
      />

      <ExpenseAdminFilterForm
        statusValue={filter.status ?? ""}
        categoryValue={filter.category ?? ""}
        applicantIdValue={applicantIdRaw ?? ""}
        fromValue={filter.from ?? ""}
        toValue={filter.to ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <ExpenseAdminSection
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

async function ExpenseAdminSection(props: {
  filter: ExpenseAdminFilter
  offset: number
  pageSize: number
  sort: ExpenseAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getExpenseAdminList(props.filter, {
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="経費申請一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "created_at_desc" ? undefined : props.sort,
    size: String(props.pageSize),
  }

  return (
    <div className="flex flex-col gap-4">
      <ExpenseAdminTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/expense/expenses"
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

function toStatus(value: string | null): ExpenseStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected" || value === "settled") {
    return value
  }

  return null
}

function toCategory(value: string | null): ExpenseCategory | null {
  if (
    value === "transport" ||
    value === "supplies" ||
    value === "entertainment" ||
    value === "books" ||
    value === "other"
  ) {
    return value
  }

  return null
}

function toApplicantId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}

function toSort(raw: string | null): ExpenseAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as ExpenseAdminSort
  }

  return "created_at_desc"
}
