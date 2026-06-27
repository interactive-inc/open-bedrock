import { DeleteRoleButton } from "@/app/(app)/admin/roles/_components/delete-role-button"
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
import { getRoles } from "@/lib/api/get-roles"

// GET /roles を実行しロール一覧テーブルを描画する非同期 RSC。
export async function RoleListSection() {
  const roles = await getRoles()

  if (roles instanceof Error) {
    return <FetchError message="ロール一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{roles.length} 件</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>キー</TableHead>
            <TableHead>名前</TableHead>
            <TableHead>説明</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-mono text-sm">{role.key}</TableCell>
              <TableCell>{role.name}</TableCell>
              <TableCell className="text-muted-foreground">{role.description ?? "—"}</TableCell>
              <TableCell>
                {role.is_system ? (
                  <Badge variant="secondary">システム</Badge>
                ) : (
                  <Badge variant="outline">動的</Badge>
                )}
              </TableCell>
              <TableCell>{role.is_system ? null : <DeleteRoleButton roleId={role.id} />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
