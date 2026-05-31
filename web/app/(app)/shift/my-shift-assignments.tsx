import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

type Props = {
  assignments: Array<ShiftAssignmentResponse>
}

// 本人の担当シフト一覧。日付・パターン・備考・公開状態をテーブルで表示する。
export function MyShiftAssignments(props: Props) {
  if (props.assignments.length === 0) {
    return <p className="text-sm text-muted-foreground">担当シフトはありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>パターン ID</TableHead>
          <TableHead>備考</TableHead>
          <TableHead>状態</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.assignments.map((assignment) => (
          <TableRow key={assignment.id}>
            <TableCell className="font-medium">{assignment.date}</TableCell>

            <TableCell className="tabular-nums">{assignment.pattern_id}</TableCell>

            <TableCell className="text-muted-foreground">{assignment.note ?? "-"}</TableCell>

            <TableCell>
              {assignment.published_at !== null ? (
                <Badge>公開済み</Badge>
              ) : (
                <Badge variant="outline">未公開</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
