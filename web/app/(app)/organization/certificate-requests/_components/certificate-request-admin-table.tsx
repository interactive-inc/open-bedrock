import Link from "next/link"
import { CertificateRequestAdminActions } from "@/app/(app)/organization/certificate-requests/_components/certificate-request-admin-actions"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format-date-time"
import { statusLabel } from "@/lib/status-label"

type Row = {
  id: string
  requester_id: string
  certificate_type: string
  submit_to: string | null
  needed_by: string | null
  note: string | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
  canManage: boolean
}

/** 全社の証明書発行依頼一覧テーブル。詳細は各依頼のページへ、依頼者名クリックで絞り込む。 */
export function CertificateRequestAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する証明書発行依頼がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の証明書発行依頼 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>依頼者 ID</TableHead>
            <TableHead className="hidden md:table-cell">提出先</TableHead>
            <TableHead className="hidden md:table-cell">希望日</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">依頼日</TableHead>
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="font-medium">{row.certificate_type}</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/organization/certificate-requests?employee_id=${row.requester_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.requester_id} の証明書発行依頼で絞り込む`}
                >
                  {row.requester_id}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.submit_to ?? "—"}
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.needed_by ?? "—"}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>

              {props.canManage ? (
                <TableCell>
                  {row.status === "requested" ? (
                    <CertificateRequestAdminActions certificateRequestId={row.id} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
