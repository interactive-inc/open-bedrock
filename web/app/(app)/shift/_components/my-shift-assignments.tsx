import { EmptyState } from "@/components/empty-state"
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
  patternNameMap: Record<number, string>
}

// 本人の担当シフト一覧。日付・パターン・備考・公開状態をテーブルで表示する。
export function MyShiftAssignments(props: Props) {
  if (props.assignments.length === 0) {
    return <EmptyState title="担当シフトはありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            <TableHead>パターン</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">{assignment.date}</TableCell>

              <TableCell>
                {assignment.pattern_id !== null
                  ? (props.patternNameMap[assignment.pattern_id] ?? "-")
                  : "-"}
              </TableCell>

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
    </div>
  )
}
