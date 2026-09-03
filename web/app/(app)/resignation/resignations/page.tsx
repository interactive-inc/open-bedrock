import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ResignationAdminFilterForm } from "@/app/(app)/resignation/resignations/_components/resignation-admin-filter-form"
import { ResignationAdminTable } from "@/app/(app)/resignation/resignations/_components/resignation-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getResignationAdminList,
  type ResignationAdminFilter,
} from "@/lib/api/get-resignation-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canManageResignations } from "@/lib/resignation/can-manage-resignations"
import { canViewAllResignations } from "@/lib/resignation/can-view-all-resignations"

export const metadata = { title: "退職手続き管理" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/** 全社の退職手続きを横断で確認する画面。resignation:read:all を持つロールのみ表示できる。 */
export default async function AdminResignationsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllResignations(currentUser.permissions) === false) {
    notFound()
  }

  const canManage = canManageResignations(currentUser.permissions)

  const params = await props.searchParams

  const status = toSingleValue(params.status)

  const employeeIdRaw = toSingleValue(params.employee_id)

  const employeeId = toEmployeeId(employeeIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: ResignationAdminFilter = {
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
        title="退職手続き管理"
        description="全社の退職手続きを横断で確認します。"
        breadcrumbs={[
          { label: "退職手続き", href: "/resignation/resignations" },
          { label: "退職手続き管理" },
        ]}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/resignation/resignations" />}
          >
            自分の手続き
          </Button>
        }
      />

      <ResignationAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <ResignationAdminSection
          filter={filter}
          offset={offset}
          extraParams={extraParams}
          canManage={canManage}
        />
      </Suspense>
    </div>
  )
}

async function ResignationAdminSection(props: {
  filter: ResignationAdminFilter
  offset: number
  extraParams: Record<string, string | undefined>
  canManage: boolean
}) {
  const result = await getResignationAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="退職手続き一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <ResignationAdminTable rows={result.data} total={result.total} canManage={props.canManage} />

      <TablePagination
        pathname="/resignation/resignations"
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

function toEmployeeId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}
