import { toDurationLabel } from "@/app/(app)/my/attendances/_lib/to-duration-label"
import { formatDateTime } from "@/lib/format-date-time"
import { Badge } from "@/components/ui/badge"
import { statusLabel } from "@/lib/status-label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** api の実レスポンス（snake_case）と同形の表示用レコード型。 */
type AttendanceRecord = {
  id: number
  employee_id: number
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  work_minutes: number | null
  status: string
}

type Props = {
  records: ReadonlyArray<AttendanceRecord>
  // 従業員 ID 列を表示するか。管理者一覧では true、本人画面では false。
  withEmployeeId: boolean
}

/**
 * 勤怠レコードをテーブル描画する表示専用コンポーネント。本人 / 管理者で共有する。
 * status はバッジ、勤務時間は分を Hh Mm へ整形して表示する。
 */
export function AttendanceRecordTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>勤務日</TableHead>

            {props.withEmployeeId ? <TableHead>従業員</TableHead> : null}

            <TableHead>出勤</TableHead>
            <TableHead>退勤</TableHead>
            <TableHead className="text-right">勤務</TableHead>
            <TableHead>ステータス</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-medium">{record.work_date}</TableCell>

              {props.withEmployeeId ? <TableCell>#{record.employee_id}</TableCell> : null}

              <TableCell>{formatDateTime(record.clock_in_at)}</TableCell>

              <TableCell>{formatDateTime(record.clock_out_at)}</TableCell>

              <TableCell className="text-right">{toDurationLabel(record.work_minutes)}</TableCell>

              <TableCell>
                <Badge variant={record.status === "closed" ? "secondary" : "outline"}>
                  {statusLabel(record.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
