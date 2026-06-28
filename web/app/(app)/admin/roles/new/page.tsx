import { RoleCreateForm } from "@/app/(app)/admin/roles/_components/role-create-form"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { getPermissions } from "@/lib/api/get-permissions"
import { notFound } from "next/navigation"

export const metadata = { title: "ロール作成" }

// ロール作成画面。権限カタログを取得してチェックボックスフォームに渡す（iam:manage_roles が必要）。
// 権限が無いユーザーには 404 を返す。
export default async function AdminRoleNewPage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("iam:manage_roles") === false
  ) {
    notFound()
  }

  const permissions = await getPermissions()

  if (permissions instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="ロール作成" description="新しいロールを作成します。" />

        <FetchError message="権限カタログの取得に失敗しました" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ロール作成" description="新しいロールを作成し、権限を割り当てます。" />

      <RoleCreateForm permissions={permissions} />
    </div>
  )
}
