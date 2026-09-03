import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CertificationResponse } from "@/lib/api/types/certification-types"

type Props = {
  rows: ReadonlyArray<CertificationResponse>
  canManage: boolean
}

/** 資格マスタ一覧テーブル。管理権限の有無で表示メッセージを出し分ける。 */
export function CertificationsTable(props: Props) {
  if (props.rows.length === 0) {
    return (
      <EmptyState
        title="登録済みの資格がありません"
        description={
          props.canManage
            ? "資格マスタは karte certifications create で登録できます"
            : "資格マスタの登録は管理者に依頼してください"
        }
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`資格マスタ ${props.rows.length} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="hidden md:table-cell">発行元</TableHead>
            <TableHead className="hidden lg:table-cell">説明</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-sm">{row.code}</TableCell>

              <TableCell className="font-medium">{row.name}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.issuer ?? "—"}
              </TableCell>

              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {row.description ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
