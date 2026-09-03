import Link from "next/link"
import { Suspense } from "react"
import { AttendanceAdminList } from "@/app/(app)/my/attendances/_components/attendance-admin-list"
import { AttendanceFilterForm } from "@/app/(app)/my/attendances/_components/attendance-filter-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "勤怠（全体）" }

type Props = {
  searchParams: Promise<{ employee_id?: string; from?: string; to?: string }>
}

/**
 * 勤怠一覧（管理者）画面。employee_id / from / to で全体の勤怠を絞り込んで表示する RSC。
 * 権限がない場合は子の RSC 内でエラーメッセージにフォールバックする。
 */
export default async function AttendanceAllPage(props: Props) {
  await requirePermission("attendance:read:all")

  const searchParams = await props.searchParams

  const employeeId = typeof searchParams.employee_id === "string" ? searchParams.employee_id : null

  const from = typeof searchParams.from === "string" ? searchParams.from : null

  const to = typeof searchParams.to === "string" ? searchParams.to : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="勤怠一覧（管理者）"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/my/attendances" />}>
            自分の勤怠へ
          </Button>
        }
      />

      <AttendanceFilterForm withEmployeeId={true} employeeId={employeeId} from={from} to={to} />

      <Suspense
        key={`${employeeId ?? ""}:${from ?? ""}:${to ?? ""}`}
        fallback={<ListSkeleton rows={5} />}
      >
        <AttendanceAdminList employeeId={employeeId} from={from} to={to} />
      </Suspense>
    </div>
  )
}
