import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { FamilyCareLeaveAdminFilterForm } from "@/app/(app)/family-care-leave/family-care-leaves/_components/family-care-leave-admin-filter-form"
import { FamilyCareLeaveAdminTable } from "@/app/(app)/family-care-leave/family-care-leaves/_components/family-care-leave-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getFamilyCareLeaveAdminList,
  type FamilyCareLeaveAdminFilter,
} from "@/lib/api/get-family-care-leave-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canManageFamilyCareLeaves } from "@/lib/family-care-leave/can-manage-family-care-leaves"
import { canViewAllFamilyCareLeaves } from "@/lib/family-care-leave/can-view-all-family-care-leaves"

export const metadata = { title: "休業の横断" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/** 全社の産休・育休・介護休業の申出を横断で確認する画面。family_care_leave:read:all を持つロールのみ表示できる。 */
export default async function AdminFamilyCareLeavesPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canViewAllFamilyCareLeaves(currentUser.permissions) === false
  ) {
    notFound()
  }

  const canManage = canManageFamilyCareLeaves(currentUser.permissions)

  const params = await props.searchParams

  const status = toSingleValue(params.status)

  const employeeIdRaw = toSingleValue(params.employee_id)

  const employeeId = toEmployeeId(employeeIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: FamilyCareLeaveAdminFilter = {
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
      <PageHeader title="休業の横断">
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/family-care-leave/family-care-leaves" />}
        >
          自分の申出
        </Button>
      </PageHeader>

      <FamilyCareLeaveAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <FamilyCareLeaveAdminSection
          filter={filter}
          offset={offset}
          extraParams={extraParams}
          canManage={canManage}
        />
      </Suspense>
    </div>
  )
}

async function FamilyCareLeaveAdminSection(props: {
  filter: FamilyCareLeaveAdminFilter
  offset: number
  extraParams: Record<string, string | undefined>
  canManage: boolean
}) {
  const result = await getFamilyCareLeaveAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="産休・育休・介護休業の申出一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <FamilyCareLeaveAdminTable
        rows={result.data}
        total={result.total}
        canManage={props.canManage}
      />

      <TablePagination
        pathname="/family-care-leave/family-care-leaves"
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
