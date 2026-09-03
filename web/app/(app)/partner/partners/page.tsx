import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { PartnerFilterForm } from "@/app/(app)/partner/partners/_components/partner-filter-form"
import { PartnerStatusBadge } from "@/app/(app)/partner/partners/_components/partner-status-badge"
import { partnerCategoryLabel } from "@/app/(app)/partner/partners/_lib/partner-category-label"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getPartnerList } from "@/lib/api/get-partner-list"
import type { PartnerStatus } from "@/lib/api/types/partner-types"
import { canManagePartners } from "@/lib/partner/can-manage-partners"

export const metadata = { title: "取引先" }

const VALID_STATUSES = ["active", "archived"] as const

function toPartnerStatus(value: string | undefined): PartnerStatus | null {
  return VALID_STATUSES.find((status) => status === value) ?? null
}

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>
}

/** 取引先一覧画面。キーワード・状態で絞り込み、RSC でサーバ取得してテーブル表示する。 */
export default async function PartnersPage(props: Props) {
  const searchParams = await props.searchParams

  const q = searchParams.q !== undefined && searchParams.q !== "" ? searchParams.q : null

  const status = toPartnerStatus(searchParams.status)

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManagePartners(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="取引先"
        actions={
          canManage ? (
            <Button nativeButton={false} render={<Link href="/partner/partners/new" />}>
              取引先を登録
            </Button>
          ) : null
        }
      />

      <PartnerFilterForm q={q} status={status} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <PartnersTable q={q} status={status} />
      </Suspense>
    </div>
  )
}

type TableProps = {
  q: string | null
  status: PartnerStatus | null
}

/** /partners を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function PartnersTable(props: TableProps) {
  const partners = await getPartnerList({ q: props.q, status: props.status })

  if (partners instanceof Error) {
    return <FetchError message="取引先一覧の取得に失敗しました" />
  }

  if (partners.length === 0) {
    return <EmptyState title="該当する取引先はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="取引先一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>分類</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.code}>
              <TableCell>
                <Link
                  href={`/partner/partners/${partner.code}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {partner.code}
                </Link>
              </TableCell>

              <TableCell>{partner.name}</TableCell>

              <TableCell>{partnerCategoryLabel(partner.category)}</TableCell>

              <TableCell>
                <PartnerStatusBadge status={partner.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
