import { FetchError } from "@/components/fetch-error"
import { TablePagination } from "@/components/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAuditLogs, type AuditLogFilter } from "@/lib/api/get-audit-logs"

type Props = {
  filter: AuditLogFilter
  limit: number
  offset: number
  extraParams: Record<string, string | undefined>
}

// GET /audit-logs を実行し、監査ログを新しい順にテーブル表示する非同期 RSC。読み取り専用。
export async function AuditLogListSection(props: Props) {
  const result = await getAuditLogs(props.filter, { limit: props.limit, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="監査ログの取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label="監査ログ一覧">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>日時</TableHead>
              <TableHead>操作者</TableHead>
              <TableHead>アクション</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>metadata</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  監査ログはありません
                </TableCell>
              </TableRow>
            ) : (
              result.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.id}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{log.created_at}</TableCell>
                  <TableCell className="font-mono text-xs">{log.actor_account_id ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.target_type ?? "—"}
                    {log.target_id === null ? "" : ` #${log.target_id}`}
                  </TableCell>
                  <TableCell className="max-w-xs break-all font-mono text-xs">
                    {log.metadata ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/admin/audit-logs"
        total={result.total}
        limit={props.limit}
        offset={props.offset}
        extraParams={props.extraParams}
      />
    </div>
  )
}
