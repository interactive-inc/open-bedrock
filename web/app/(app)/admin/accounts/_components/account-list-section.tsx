import {
  AccountStatusButton,
  ResetPasswordButton,
  RevokeRoleButton,
} from "@/app/(app)/admin/accounts/_components/account-actions"
import { GrantRoleForm } from "@/app/(app)/admin/accounts/_components/grant-role-form"
import { FetchError } from "@/components/fetch-error"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAccounts } from "@/lib/api/get-accounts"
import { getRoles } from "@/lib/api/get-roles"

// GET /accounts を実行しアカウント一覧テーブルを描画する非同期 RSC。
// 各行にロール付与フォームを置く。割当可能なロールは GET /roles から取得する。
export async function AccountListSection() {
  const accounts = await getAccounts()

  if (accounts instanceof Error) {
    return <FetchError message="アカウント一覧の取得に失敗しました" />
  }

  const roles = await getRoles()

  const roleKeys = roles instanceof Error ? [] : roles.map((role) => role.key)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{accounts.length} 件</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>従業員</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>ロール</TableHead>
            <TableHead>ロール付与</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell>{account.employee_name ?? "（未紐付け）"}</TableCell>
              <TableCell>
                <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                  {account.status}
                </Badge>
              </TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {account.role_keys.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  account.role_keys.map((roleKey) => (
                    <Badge key={roleKey} variant="outline" className="font-mono text-xs">
                      {roleKey}
                      <RevokeRoleButton accountId={account.id} roleKey={roleKey} />
                    </Badge>
                  ))
                )}
              </TableCell>
              <TableCell>
                <GrantRoleForm accountId={account.id} roleKeys={roleKeys} />
              </TableCell>
              <TableCell className="flex gap-2">
                <AccountStatusButton accountId={account.id} status={account.status} />

                <ResetPasswordButton accountId={account.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
