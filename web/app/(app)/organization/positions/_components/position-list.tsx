import { EmptyState } from "@/components/empty-state"
import { PositionRowActions } from "@/app/(app)/organization/positions/_components/position-row-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PositionResponse } from "@/lib/api/types/position-types"

type Props = {
  positions: ReadonlyArray<PositionResponse>
  canManage: boolean
}

/** 役職マスタ一覧テーブル。canManage のときだけ各行に変更・削除の操作列を出す。 */
export function PositionList(props: Props) {
  if (props.positions.length === 0) {
    return (
      <EmptyState
        title="役職がありません"
        description="右上の「新規役職」から役職を登録しましょう。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="text-right">ランク</TableHead>
            <TableHead>説明</TableHead>
            {props.canManage ? <TableHead className="text-right">操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.positions.map((position) => (
            <TableRow key={position.id}>
              <TableCell className="font-medium">{position.code}</TableCell>

              <TableCell>{position.name}</TableCell>

              <TableCell className="text-right">{position.rank}</TableCell>

              <TableCell className="text-muted-foreground">{position.description ?? "-"}</TableCell>

              {props.canManage ? (
                <TableCell className="text-right">
                  <PositionRowActions position={position} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
