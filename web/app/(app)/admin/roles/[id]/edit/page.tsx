import { RoleEditForm } from "@/app/(app)/admin/roles/_components/role-edit-form"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { getPermissions } from "@/lib/api/get-permissions"
import { getRole } from "@/lib/api/get-role"
import { notFound } from "next/navigation"

export const metadata = { title: "ロール編集" }

type Props = {
  params: Promise<{ id: string }>
}

// ロール編集画面。現在のロールと権限カタログを取得してフォームに渡す（iam:manage_roles が必要）。
// 権限が無いユーザーには 404 を返す。
export default async function AdminRoleEditPage(props: Props) {
  const [currentUser, params] = await Promise.all([getMe(), props.params])

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("iam:manage_roles") === false
  ) {
    notFound()
  }

  const roleId = Number(params.id)

  if (Number.isInteger(roleId) === false || roleId <= 0) {
    notFound()
  }

  const [role, permissions] = await Promise.all([getRole(roleId), getPermissions()])

  if (role instanceof Error || permissions instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="ロール編集"
          description="ロールの権限を変更します。"
          breadcrumbs={[
            { label: "管理", href: "/admin" },
            { label: "ロール", href: "/admin/roles" },
            { label: "編集" },
          ]}
        />

        <FetchError message="ロール情報の取得に失敗しました" />
      </div>
    )
  }

  const actorPermissionKeys = new Set(currentUser.permissions)

  const canManageTarget = role.permission_keys.every((permissionKey) =>
    actorPermissionKeys.has(permissionKey),
  )

  if (canManageTarget === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`ロール編集: ${role.name}`}
        description="名前・説明・権限を変更します。"
        breadcrumbs={[
          { label: "管理", href: "/admin" },
          { label: "ロール", href: "/admin/roles" },
          { label: role.name },
        ]}
      />

      <RoleEditForm
        roleId={role.id}
        name={role.name}
        description={role.description}
        grantedPermissionKeys={role.permission_keys}
        permissions={permissions.filter((permission) => actorPermissionKeys.has(permission.key))}
      />
    </div>
  )
}
