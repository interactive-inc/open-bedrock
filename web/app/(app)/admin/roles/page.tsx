import { RoleListSection } from "@/app/(app)/admin/roles/_components/role-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { Suspense } from "react"

export const metadata = { title: "ロール管理" }

// ロール管理画面。system role と動的ロールの一覧を表示する（iam:manage_roles が必要）。
export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="ロール管理" description="ロールと割り当てられた権限を管理します。" />

        <Link href="/admin/roles/new" className={buttonVariants({ variant: "default" })}>
          新規作成
        </Link>
      </div>

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <RoleListSection />
      </Suspense>
    </div>
  )
}
