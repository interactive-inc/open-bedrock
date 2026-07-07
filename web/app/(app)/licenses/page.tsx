import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { LicenseList } from "@/app/(app)/licenses/_components/license-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"
import { canViewAllLicenses } from "@/lib/license/can-view-all-licenses"

export const metadata = { title: "ライセンス・SaaS 台帳" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

// /licenses ライセンス・SaaS 台帳の一覧。license:read:all が無ければ notFound。
export default async function LicensesPage(props: Props) {
  const me = await getMe()

  if (me instanceof Error || canViewAllLicenses(me.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const canManage = canManageLicenses(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ライセンス・SaaS 台帳"
        description="利用中のライセンスと更新期限を記録します。支払や会計連動は行いません。"
        actions={
          canManage ? (
            <Button nativeButton={false} render={<Link href="/licenses/new" />}>
              <Plus />
              ライセンスを登録
            </Button>
          ) : null
        }
      />

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <LicenseList offset={offset} canManage={canManage} />
      </Suspense>
    </div>
  )
}
