import { EmptyState } from "@/components/empty-state"
import { GradeRowActions } from "@/app/(app)/organization/grades/_components/grade-row-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GradeResponse } from "@/lib/api/types/grade-types"

type Props = {
  grades: ReadonlyArray<GradeResponse>
  canManage: boolean
}

/** 等級マスタ一覧テーブル。canManage のときだけ各行に変更・削除の操作列を出す。 */
export function GradeList(props: Props) {
  if (props.grades.length === 0) {
    return (
      <EmptyState
        title="等級がありません"
        description="右上の「新規等級」から等級を登録しましょう。"
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
          {props.grades.map((grade) => (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.code}</TableCell>

              <TableCell>{grade.name}</TableCell>

              <TableCell className="text-right">{grade.rank}</TableCell>

              <TableCell className="text-muted-foreground">{grade.description ?? "-"}</TableCell>

              {props.canManage ? (
                <TableCell className="text-right">
                  <GradeRowActions grade={grade} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
