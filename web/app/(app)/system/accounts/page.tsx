import { AccountListSection } from "@/app/(app)/system/accounts/_components/account-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { notFound } from "next/navigation"
import { Suspense } from "react"

export const metadata = { title: "アカウント管理" }

// アカウント管理画面。従業員に紐づくアカウントと割当ロール・状態を一覧する（account:manage が必要）。
// 権限が無いユーザーには 404 を返し、管理機能の存在を露出しない。
export default async function AdminAccountsPage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("account:manage") === false
  ) {
    notFound()
  }

  const canAssignRoles = currentUser.permissions.includes("iam:assign_roles")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="アカウント管理"
        description="アカウントの状態と割り当てられたロールを管理します。"
      />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <AccountListSection
          canAssignRoles={canAssignRoles}
          actorPermissionKeys={currentUser.permissions}
        />
      </Suspense>
    </div>
  )
}
