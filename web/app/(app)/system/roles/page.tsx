import { RoleListSection } from "@/app/(app)/system/roles/_components/role-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

export const metadata = { title: "ロール管理" }

/**
 * ロール管理画面。system role と動的ロールの一覧を表示する（iam:manage_roles が必要）。
 * 権限が無いユーザーには 404 を返し、管理機能の存在を露出しない。
 */
export default async function AdminRolesPage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("iam:manage_roles") === false
  ) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="ロール管理" description="ロールと割り当てられた権限を管理します。" />

        <Link href="/system/roles/new" className={buttonVariants({ variant: "default" })}>
          新規作成
        </Link>
      </div>

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <RoleListSection actorPermissionKeys={currentUser.permissions} />
      </Suspense>
    </div>
  )
}
