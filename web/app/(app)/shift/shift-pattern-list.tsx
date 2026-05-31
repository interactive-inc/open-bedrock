import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftPatternResponse } from "@/lib/api/types/shift-types"

type Props = {
  patterns: Array<ShiftPatternResponse>
}

// シフトパターン一覧。コード・名前・勤務時間・休憩時間をテーブルで表示する。
export function ShiftPatternList(props: Props) {
  if (props.patterns.length === 0) {
    return <p className="text-sm text-muted-foreground">シフトパターンはまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>コード</TableHead>
          <TableHead>名前</TableHead>
          <TableHead>開始</TableHead>
          <TableHead>終了</TableHead>
          <TableHead>休憩（分）</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.patterns.map((pattern) => (
          <TableRow key={pattern.id}>
            <TableCell className="font-medium">{pattern.code}</TableCell>

            <TableCell>{pattern.name}</TableCell>

            <TableCell className="tabular-nums">{pattern.start_time}</TableCell>

            <TableCell className="tabular-nums">{pattern.end_time}</TableCell>

            <TableCell className="tabular-nums">{pattern.break_minutes ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
