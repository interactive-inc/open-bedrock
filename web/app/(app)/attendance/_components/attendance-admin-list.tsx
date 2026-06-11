import { AttendanceRecordTable } from "@/app/(app)/attendance/_components/attendance-record-table"
import { getAttendanceList } from "@/lib/api/get-attendance-list"

type Props = {
  employeeId: string | null
  from: string | null
  to: string | null
}

// 管理者向けの全体勤怠一覧をサーバ側 fetch してテーブル描画する非同期 RSC。
// 権限不足は api が 403 を返すため、その場合はエラーメッセージにフォールバックする。
export async function AttendanceAdminList(props: Props) {
  const employeeId = props.employeeId !== null ? Number(props.employeeId) : null

  const records = await getAttendanceList({
    employeeId: employeeId !== null && Number.isInteger(employeeId) ? employeeId : null,
    from: props.from,
    to: props.to,
  })

  if (records instanceof Error) {
    return (
      <p className="text-sm text-destructive">
        勤怠一覧の取得に失敗しました（権限が必要な場合があります）
      </p>
    )
  }

  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">勤怠がありません</p>
  }

  return <AttendanceRecordTable records={records} withEmployeeId={true} />
}
