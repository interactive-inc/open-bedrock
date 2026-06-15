import { AttendanceRecordTable } from "@/app/(app)/attendance/_components/attendance-record-table"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { getMyAttendance } from "@/lib/api/get-my-attendance"

type Props = {
  from: string | null
  to: string | null
}

// 本人の勤怠一覧をサーバ側 fetch してテーブル描画する非同期 RSC。
// from / to で期間を絞り込む。取得失敗・0 件はメッセージ表示にフォールバックする。
export async function MyAttendanceList(props: Props) {
  const records = await getMyAttendance({
    employeeId: null,
    from: props.from,
    to: props.to,
  })

  if (records instanceof Error) {
    return <FetchError message="勤怠の取得に失敗しました" />
  }

  if (records.length === 0) {
    return <EmptyState title="勤怠がありません" />
  }

  return <AttendanceRecordTable records={records} withEmployeeId={false} />
}
