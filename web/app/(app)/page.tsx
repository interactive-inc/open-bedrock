import { Suspense } from "react"
import {
  CalendarClock,
  CalendarOff,
  Coins,
  FileText,
  GraduationCap,
  HeartHandshake,
  Package,
  Sparkles,
  Target,
  TimerReset,
} from "lucide-react"
import { DashboardSummaryCards } from "@/app/(app)/_components/dashboard-summary-cards"
import { CardLink } from "@/components/card-link"
import { PageHeader } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { formatDate } from "@/lib/format-date"
import { getLeaveBalanceMe } from "@/lib/api/get-leave-balance-me"
import { getMe } from "@/lib/api/get-me"
import { getMyAttendance } from "@/lib/api/get-my-attendance"
import { listMyApplications } from "@/lib/api/list-my-applications"

export const metadata = { title: "ホーム" }

type ResourceLink = {
  label: string
  href: string
  icon: typeof TimerReset
}

const resourceLinks: ReadonlyArray<ResourceLink> = [
  { label: "勤怠", href: "/my/attendances", icon: TimerReset },
  { label: "休暇", href: "/my/leaves", icon: CalendarOff },
  { label: "申請", href: "/my/applications", icon: FileText },
  { label: "経費", href: "/my/expenses", icon: Coins },
  { label: "目標", href: "/performance-review/goals", icon: Target },
  { label: "スキル", href: "/my/skills", icon: Sparkles },
  { label: "研修", href: "/my/trainings", icon: GraduationCap },
  { label: "1on1", href: "/my/oneonones", icon: CalendarClock },
  { label: "サンクス", href: "/thanks/thanks", icon: HeartHandshake },
  { label: "貸与品", href: "/my/assets", icon: Package },
]

/** ホーム。本人の基本情報と今日の勤怠・休暇残・直近の申請、全社の件数サマリ、各 /my リソースへの導線を並べる。 */
export default async function HomePage() {
  const currentUser = await getMe()

  const profile = currentUser instanceof Error ? null : currentUser

  return (
    <>
      <PageHeader title={profile === null ? "マイページ" : profile.name} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Suspense fallback={<Skeleton className="w-full" />}>
          <TodayAttendanceCard />
        </Suspense>

        <Suspense fallback={<Skeleton className="w-full" />}>
          <LeaveBalanceCard />
        </Suspense>

        <Suspense fallback={<Skeleton className="w-full" />}>
          <RecentApplicationsCard />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">各機能へ</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {resourceLinks.map((resource) => {
            const Icon = resource.icon

            return (
              <CardLink
                key={resource.href}
                href={resource.href}
                className="flex min-h-20 flex-col items-center justify-center gap-2 pr-4 text-center"
              >
                <Icon className="size-5 text-muted-foreground" />

                <span className="text-sm font-medium">{resource.label}</span>
              </CardLink>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">全社の状況</h2>

        <Suspense fallback={<DashboardSummarySkeleton />}>
          <DashboardSummaryCards />
        </Suspense>
      </section>
    </>
  )
}

/** 全社サマリの読み込み中に並べる占位カード。 */
function DashboardSummarySkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {placeholders.map((index) => (
        <Skeleton key={index} className="w-full" />
      ))}
    </div>
  )
}

/** 今日の勤怠状態。本人の当日レコードから打刻状況を要約する。 */
async function TodayAttendanceCard() {
  const today = toTokyoDate(new Date())

  const records = await getMyAttendance({ employeeId: null, from: today, to: today })

  const record = records instanceof Error ? null : (records.at(0) ?? null)

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TimerReset className="size-4 text-muted-foreground" />

          <CardTitle>今日の勤怠</CardTitle>
        </div>

        {record === null ? (
          <CardDescription>まだ打刻がありません。</CardDescription>
        ) : (
          <CardDescription>
            出勤 {record.clock_in_at === null ? "—" : formatTime(record.clock_in_at)} / 退勤{" "}
            {record.clock_out_at === null ? "—" : formatTime(record.clock_out_at)}
          </CardDescription>
        )}

        <TextLink href="/my/attendances">勤怠を開く</TextLink>
      </CardContent>
    </Card>
  )
}

/** 休暇残。年次有給の残日数を要約する。 */
async function LeaveBalanceCard() {
  const balances = await getLeaveBalanceMe()

  const annual =
    balances instanceof Error
      ? null
      : (balances.find((balance) => balance.leave_type === "annual") ?? null)

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CalendarOff className="size-4 text-muted-foreground" />

          <CardTitle>休暇残</CardTitle>
        </div>

        {annual === null ? (
          <CardDescription>残日数を取得できませんでした。</CardDescription>
        ) : (
          <CardDescription>
            年次有給 残 {annual.remaining_days} 日（付与 {annual.granted_days} 日）
          </CardDescription>
        )}

        <TextLink href="/my/leaves">休暇を開く</TextLink>
      </CardContent>
    </Card>
  )
}

/** 直近の自分の申請。最新数件のステータスを要約する。 */
async function RecentApplicationsCard() {
  const result = await listMyApplications({ limit: 3 })

  const applications = result instanceof Error ? [] : result.data

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />

          <CardTitle>直近の申請</CardTitle>
        </div>

        {applications.length === 0 ? (
          <CardDescription>最近の申請はありません。</CardDescription>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {applications.map((application) => (
              <li
                key={application.id ?? application.created_at}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">{formatDate(application.created_at)}</span>

                <ApplicationStatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}

        <TextLink href="/my/applications">申請を開く</TextLink>
      </CardContent>
    </Card>
  )
}

/** Asia/Tokyo の当日を YYYY-MM-DD で返す（api の from/to は日付文字列を期待する）。 */
function toTokyoDate(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  return formatter.format(now)
}

/** ISO 文字列から時刻（HH:mm）だけを Asia/Tokyo で取り出す。 */
function formatTime(iso: string): string {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return formatter.format(new Date(iso))
}
