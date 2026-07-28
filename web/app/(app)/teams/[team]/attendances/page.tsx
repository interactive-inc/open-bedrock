import { AttendanceRecordTable } from "@/app/(app)/my/attendances/_components/attendance-record-table"
import { EmptyState } from "@/components/empty-state"
import { SubPageHeader } from "@/components/sub-page-header"
import { getDepartmentAttendances } from "@/lib/api/get-department-attendances"

export const metadata = { title: "部署の勤怠" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの勤怠タブ。所属メンバー全員の勤怠記録を一覧する。
 * 閲覧には attendance:read:all、または本人が所属する部署への attendance:read:department が必要。
 */
export default async function DepartmentAttendancesPage(props: Props) {
  const params = await props.params

  const records = await getDepartmentAttendances(params.team)

  if (records instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <SubPageHeader title="勤怠" />

        <EmptyState title="この部署の勤怠を閲覧する権限がありません" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="勤怠" />

      {records.length === 0 ? (
        <EmptyState title="この部署の勤怠記録はまだありません" />
      ) : (
        <AttendanceRecordTable records={records} withEmployeeId />
      )}
    </div>
  )
}
