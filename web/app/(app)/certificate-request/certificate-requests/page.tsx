import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CertificateRequestAdminFilterForm } from "@/app/(app)/certificate-request/certificate-requests/_components/certificate-request-admin-filter-form"
import { CertificateRequestAdminTable } from "@/app/(app)/certificate-request/certificate-requests/_components/certificate-request-admin-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  getCertificateRequestAdminList,
  type CertificateRequestAdminFilter,
} from "@/lib/api/get-certificate-request-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canManageCertificateRequests } from "@/lib/certificate-request/can-manage-certificate-requests"
import { canViewAllCertificateRequests } from "@/lib/certificate-request/can-view-all-certificate-requests"

export const metadata = { title: "証明書の横断" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/** 全社の証明書発行依頼を横断で確認する画面。certificate_request:read:all を持つロールのみ表示できる。 */
export default async function AdminCertificateRequestsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canViewAllCertificateRequests(currentUser.permissions) === false
  ) {
    notFound()
  }

  const canManage = canManageCertificateRequests(currentUser.permissions)

  const params = await props.searchParams

  const status = toSingleValue(params.status)

  const employeeIdRaw = toSingleValue(params.employee_id)

  const employeeId = toEmployeeId(employeeIdRaw)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const filter: CertificateRequestAdminFilter = {
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
      <PageHeader title="証明書の横断">
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/certificate-request/certificate-requests" />}
        >
          自分の依頼
        </Button>
      </PageHeader>

      <CertificateRequestAdminFilterForm
        statusValue={filter.status ?? ""}
        employeeIdValue={employeeIdRaw ?? ""}
      />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <CertificateRequestAdminSection
          filter={filter}
          offset={offset}
          extraParams={extraParams}
          canManage={canManage}
        />
      </Suspense>
    </div>
  )
}

async function CertificateRequestAdminSection(props: {
  filter: CertificateRequestAdminFilter
  offset: number
  extraParams: Record<string, string | undefined>
  canManage: boolean
}) {
  const result = await getCertificateRequestAdminList(props.filter, {
    limit: PAGE_SIZE,
    offset: props.offset,
  })

  if (result instanceof Error) {
    return <FetchError message="証明書発行依頼一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <CertificateRequestAdminTable
        rows={result.data}
        total={result.total}
        canManage={props.canManage}
      />

      <TablePagination
        pathname="/certificate-request/certificate-requests"
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
