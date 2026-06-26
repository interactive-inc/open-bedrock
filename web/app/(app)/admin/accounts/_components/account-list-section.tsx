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

// GET /accounts を実行しアカウント一覧テーブルを描画する非同期 RSC。
export async function AccountListSection() {
  const accounts = await getAccounts()

  if (accounts instanceof Error) {
    return <FetchError message="アカウント一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{accounts.length} 件</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>従業員</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>ロール</TableHead>
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
                    </Badge>
                  ))
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
