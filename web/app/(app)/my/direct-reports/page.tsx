import { Suspense } from "react"
import { CardLink } from "@/components/card-link"
import { CalendarOff, Target, TimerReset, Users } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format-date"
import { getMe } from "@/lib/api/get-me"
import { getMyReports } from "@/lib/api/get-my-reports"
import { getReportsAttendance } from "@/lib/api/get-reports-attendance"
import { getReportsGoals } from "@/lib/api/get-reports-goals"
import { getReportsLeaveRequests } from "@/lib/api/get-reports-leave-requests"
import { canReadReportsOvertime } from "@/lib/attendance/can-read-reports-overtime"
import { canReadReportsGoals } from "@/lib/goal/can-read-reports-goals"
import { canReadReportsLeaves } from "@/lib/leave/can-read-reports-leaves"

export const metadata = { title: "マイチーム" }

/**
 * マイチーム。直属部下の一覧と、配下スコープの勤怠・休暇・目標を文脈導線としてまとめる。
 * 各スコープ節は対応する permission を持つ場合のみ描画する。
 */
export default async function MyReportsPage() {
  const currentUser = await getMe()

  const permissions = currentUser instanceof Error ? [] : currentUser.permissions

  return (
    <>
      <PageHeader title="マイチーム" />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-24 w-full" />}>
        <ReportsGrid />
      </Suspense>

      {canReadReportsOvertime(permissions) ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TimerReset className="size-4 text-muted-foreground" />

            <h2 className="text-lg font-medium">チームの勤怠（直近）</h2>
          </div>

          <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-10 w-full" />}>
            <TeamAttendanceSection />
          </Suspense>
        </section>
      ) : null}

      {canReadReportsLeaves(permissions) ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarOff className="size-4 text-muted-foreground" />

            <h2 className="text-lg font-medium">チームの休暇申請</h2>
          </div>

          <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-10 w-full" />}>
            <TeamLeaveSection />
          </Suspense>
        </section>
      ) : null}

      {canReadReportsGoals(permissions) ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />

            <h2 className="text-lg font-medium">チームの目標</h2>
          </div>

          <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-10 w-full" />}>
            <TeamGoalSection />
          </Suspense>
        </section>
      ) : null}
    </>
  )
}

/** 直属部下のカード一覧。各人は従業員詳細へ遷移する。 */
async function ReportsGrid() {
  const result = await getMyReports()

  if (result instanceof Error) {
    return <FetchError message="直属部下の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="直属の部下はいません"
        description="あなたを管理者とする在籍中の従業員がここに表示されます。"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.data.map((report) => (
        <CardLink
          key={report.code}
          href={`/company/employees/${report.code}`}
          className="flex min-h-24 flex-col gap-2"
        >
          <CardTitle>{report.name}</CardTitle>

          <CardDescription>
            {[report.dept_name, report.position].filter((value) => value !== null).join(" / ") ||
              "所属未設定"}
          </CardDescription>
        </CardLink>
      ))}
    </div>
  )
}

/** 配下の勤怠（直近）。件数と最新数件を要約する。 */
async function TeamAttendanceSection() {
  const records = await getReportsAttendance()

  if (records instanceof Error) {
    return <FetchError message="チームの勤怠を取得できませんでした" />
  }

  if (records.length === 0) {
    return <EmptyState title="対象の勤怠記録はありません" />
  }

  const recent = [...records]
    .sort((left, right) => right.work_date.localeCompare(left.work_date))
    .slice(0, 5)

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2 text-sm">
          {recent.map((record) => (
            <li key={record.id} className="flex items-center justify-between gap-2">
              <span>{formatDate(record.work_date)}</span>

              <span className="text-muted-foreground">
                {record.work_minutes === null
                  ? record.status
                  : `${Math.round(record.work_minutes / 60)} 時間`}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** 配下の休暇申請。申請者・期間・ステータスを一覧する。 */
async function TeamLeaveSection() {
  const result = await getReportsLeaveRequests({ limit: 10 })

  if (result instanceof Error) {
    return <FetchError message="チームの休暇申請を取得できませんでした" />
  }

  if (result.length === 0) {
    return <EmptyState title="配下の休暇申請はありません" />
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2 text-sm">
          {result.map((request) => (
            <li key={request.id} className="flex items-center justify-between gap-2">
              <span>
                {request.applicant_name}
                <span className="text-muted-foreground">
                  {" "}
                  {formatDate(request.start_date)}〜{formatDate(request.end_date)}
                </span>
              </span>

              <ApplicationStatusBadge status={request.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** 配下の目標。期間・タイトル・ステータスを一覧する。 */
async function TeamGoalSection() {
  const goals = await getReportsGoals()

  if (goals instanceof Error) {
    return <FetchError message="チームの目標を取得できませんでした" />
  }

  if (goals.length === 0) {
    return <EmptyState title="配下の目標はありません" />
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2 text-sm">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="text-muted-foreground">{goal.period}</span> {goal.title}
              </span>

              <span className="text-muted-foreground">{goal.status}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
