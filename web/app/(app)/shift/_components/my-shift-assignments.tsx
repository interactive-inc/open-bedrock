import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MyShiftAssignmentResponse } from "@/lib/api/types/shift-types"

type Props = {
  assignments: Array<MyShiftAssignmentResponse>
}

// 本人の担当シフト一覧。日付・パターン・時間帯・備考をテーブルで表示する。
// GET /shift/assignments/me は公開済みのみ返すため、公開状態列は持たない。
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
            <TableHead>時間帯</TableHead>
            <TableHead>備考</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">{assignment.date}</TableCell>

              <TableCell>{assignment.pattern_name ?? "-"}</TableCell>

              <TableCell className="text-muted-foreground">
                {assignment.pattern_start_time !== null && assignment.pattern_end_time !== null
                  ? `${assignment.pattern_start_time}–${assignment.pattern_end_time}`
                  : "-"}
              </TableCell>

              <TableCell className="text-muted-foreground">{assignment.note ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
