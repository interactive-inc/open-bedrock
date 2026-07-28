"use client"

import {
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileText,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Package,
  Sparkles,
  Target,
  TimerReset,
  User,
  UserCog,
  Users,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { FlatDepartment } from "@/lib/org/flatten-org-tree"

export type MyDepartment = {
  code: string
  name: string
  assignment_type: "primary" | "concurrent"
}

type Props = {
  inboxCounts: import("@/lib/api/types/inbox-types").InboxCounts
  unreadNotificationCount: number
  // 本人が持つ permission キー。これに含まれる requiredPermission の項目だけ表示する。
  permissions: ReadonlyArray<string>
  // 本人が所属する部署（主配属を先頭）。部署タブの Select の既定値と「自分の部署」群に使う。
  myDepartments: ReadonlyArray<MyDepartment>
  // 全部署（組織ツリーの表示順・深さ付き）。部署タブの Select の選択肢に使う。
  allDepartments: ReadonlyArray<FlatDepartment>
}

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  // いずれか1つを持てば表示（OR）。requiredPermission と併用しない。
  requiredAnyPermission?: ReadonlyArray<string>
  // すべて持つ場合のみ表示（AND）。requiredPermission と併用しない。
  requiredAllPermissions?: ReadonlyArray<string>
  prefetch?: boolean
}

type Section = {
  heading: string | null
  items: ReadonlyArray<NavItem>
}

type SpaceKey = "my" | "teams" | "organization" | "system"

type Space = {
  key: SpaceKey
  label: string
  icon: LucideIcon
  sections: ReadonlyArray<Section>
}

type PermissionGate = {
  requiredPermission?: string
  requiredAnyPermission?: ReadonlyArray<string>
  requiredAllPermissions?: ReadonlyArray<string>
}

function isAllowed(gate: PermissionGate, permissions: ReadonlySet<string>): boolean {
  if (gate.requiredPermission !== undefined && permissions.has(gate.requiredPermission) === false) {
    return false
  }

  if (
    gate.requiredAnyPermission !== undefined &&
    gate.requiredAnyPermission.some((permission) => permissions.has(permission)) === false
  ) {
    return false
  }

  if (
    gate.requiredAllPermissions !== undefined &&
    gate.requiredAllPermissions.every((permission) => permissions.has(permission)) === false
  ) {
    return false
  }

  return true
}

/** permission を持つ項目だけに絞り込み、空になったセクションは畳む。 */
function filterSections(
  sections: ReadonlyArray<Section>,
  permissions: ReadonlySet<string>,
): ReadonlyArray<Section> {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isAllowed(item, permissions)),
    }))
    .filter((section) => section.items.length > 0)
}

const teamScopePermissions: ReadonlyArray<string> = [
  "goal:read:reports",
  "attendance:read:reports",
  "leave:read:reports",
]

const mySections: ReadonlyArray<Section> = [
  {
    heading: null,
    items: [
      { label: "マイページ", href: "/my", icon: LayoutDashboard },
      { label: "受信箱", href: "/inbox", icon: Inbox },
      { label: "通知", href: "/notifications", icon: Bell },
    ],
  },
  {
    heading: "業務",
    items: [
      { label: "勤怠", href: "/my/attendances", icon: TimerReset },
      { label: "休暇", href: "/my/leaves", icon: CalendarOff },
      { label: "申請", href: "/my/applications", icon: FileText },
      { label: "経費", href: "/my/expenses", icon: Coins },
      { label: "シフト", href: "/my/shifts", icon: CalendarDays },
      { label: "評価", href: "/my/reviews", icon: ClipboardCheck },
      { label: "オンボーディング", href: "/my/onboarding-tasks", icon: ClipboardList },
    ],
  },
  {
    heading: "手続き",
    items: [
      { label: "出張", href: "/my/business-trips", icon: ClipboardList },
      { label: "証明書", href: "/my/certificate-requests", icon: FileText },
      { label: "ライフイベント", href: "/my/life-events", icon: ClipboardList },
      { label: "介護休業", href: "/my/family-care-leaves", icon: HeartHandshake },
      { label: "退職", href: "/my/resignations", icon: FileText },
      { label: "稟議", href: "/my/ringis", icon: FileText },
      { label: "反社チェック", href: "/my/antisocial-checks", icon: ClipboardCheck },
      { label: "レンタル", href: "/my/rentals", icon: Package },
    ],
  },
  {
    heading: "成長",
    items: [
      { label: "スキル", href: "/my/skills", icon: Sparkles },
      { label: "キャリア", href: "/my/career", icon: Briefcase },
      { label: "研修", href: "/my/trainings", icon: GraduationCap },
      { label: "1on1", href: "/my/oneonones", icon: CalendarClock },
    ],
  },
  {
    heading: "持ち物",
    items: [
      { label: "貸与品", href: "/my/assets", icon: Package },
      { label: "会議室の予約", href: "/my/room-reservations", icon: DoorOpen },
    ],
  },
  {
    heading: null,
    items: [{ label: "設定", href: "/my/settings", icon: UserCog }],
  },
]

const organizationSections: ReadonlyArray<Section> = [
  {
    heading: null,
    items: [
      { label: "従業員", href: "/organization/employees", icon: Users },
      { label: "組織図", href: "/organization/departments", icon: GitBranch },
      { label: "ナレッジ", href: "/organization/knowledge-articles", icon: BookOpen },
      { label: "アナウンス", href: "/organization/announcements", icon: Bell },
      { label: "規程集", href: "/organization/regulations", icon: BookOpenCheck },
      { label: "目標", href: "/organization/goals", icon: Target },
      { label: "サンクス", href: "/organization/thanks", icon: HeartHandshake },
      { label: "サーベイ", href: "/organization/surveys", icon: MessagesSquare },
      { label: "社内公募", href: "/organization/job-postings", icon: Briefcase },
      { label: "表彰", href: "/organization/commendations", icon: Award },
      { label: "会議室", href: "/organization/rooms", icon: DoorOpen },
      { label: "備品", href: "/organization/assets", icon: Boxes },
      { label: "カレンダー", href: "/organization/calendars", icon: CalendarDays },
    ],
  },
  {
    heading: "マスタ",
    items: [
      { label: "等級", href: "/organization/grades", icon: Award },
      { label: "役職", href: "/organization/positions", icon: Briefcase },
      { label: "資格・免許", href: "/organization/certifications", icon: Award },
      { label: "スキル一覧", href: "/organization/skills", icon: Sparkles },
      { label: "研修コース", href: "/organization/trainings", icon: GraduationCap },
      { label: "景品", href: "/organization/rewards", icon: Sparkles },
    ],
  },
  {
    heading: "経営と対外",
    items: [
      { label: "会議体", href: "/organization/meetings", icon: CalendarDays },
      { label: "意思決定記録", href: "/organization/decisions", icon: BookOpenCheck },
      { label: "取引先", href: "/organization/partners", icon: Building2 },
      {
        label: "経営ダッシュボード",
        href: "/organization/dashboards/management",
        icon: LayoutDashboard,
        requiredPermission: "management_dashboard:view",
      },
      {
        label: "稟議の横断",
        href: "/organization/ringis",
        icon: FileText,
        requiredPermission: "ringi:read:all",
      },
      {
        label: "予算",
        href: "/organization/budgets",
        icon: Coins,
        requiredPermission: "budget:manage",
      },
      {
        label: "文書台帳",
        href: "/organization/documents",
        icon: FileText,
        requiredPermission: "document:read:all",
      },
      {
        label: "規程・手続き",
        href: "/organization/governance",
        icon: BookOpenCheck,
        requiredPermission: "governance:read",
      },
    ],
  },
  {
    heading: "人事・労務",
    items: [
      {
        label: "全社の勤怠",
        href: "/organization/attendances",
        icon: TimerReset,
        requiredPermission: "attendance:read:all",
      },
      {
        label: "全社の休暇",
        href: "/organization/leaves",
        icon: CalendarOff,
        requiredPermission: "leave:read:all",
      },
      {
        label: "全社の申請",
        href: "/organization/applications",
        icon: FileText,
        requiredPermission: "application:read:all",
      },
      {
        label: "全社の経費",
        href: "/organization/expenses",
        icon: Coins,
        requiredPermission: "expense:read:all",
      },
      {
        label: "申請テンプレート",
        href: "/organization/application-templates",
        icon: FileText,
        requiredPermission: "application_template:manage",
      },
      {
        label: "ワークフロー修復",
        href: "/organization/workflow-repairs",
        icon: Wrench,
        requiredAllPermissions: ["application:read:all", "application_template:manage"],
      },
      {
        label: "評価サイクル",
        href: "/organization/review-cycles",
        icon: ClipboardCheck,
        requiredPermission: "review:administer",
      },
      {
        label: "評価結果",
        href: "/organization/reviews",
        icon: ClipboardCheck,
        requiredPermission: "review:administer",
      },
      {
        label: "採用",
        href: "/organization/recruitments",
        icon: Users,
        requiredPermission: "recruitment:manage",
      },
      {
        label: "オンボーディングテンプレート",
        href: "/organization/onboarding-templates",
        icon: ClipboardList,
        requiredPermission: "onboarding:manage",
      },
      {
        label: "オンボーディング割当",
        href: "/organization/onboarding-assignments",
        icon: ClipboardList,
        requiredPermission: "onboarding:view:all",
      },
      {
        label: "人員計画",
        href: "/organization/headcount-plans",
        icon: Users,
        requiredPermission: "headcount_plan:read:all",
      },
      {
        label: "健診の実施記録",
        href: "/organization/health-checkups",
        icon: ClipboardCheck,
        requiredPermission: "health_checkup:read:all",
      },
      {
        label: "労災・事故",
        href: "/organization/work-accidents",
        icon: ClipboardList,
        requiredPermission: "work_accident:read:all",
      },
      {
        label: "証明書の横断",
        href: "/organization/certificate-requests",
        icon: FileText,
        requiredPermission: "certificate_request:read:all",
      },
      {
        label: "退職の横断",
        href: "/organization/resignations",
        icon: FileText,
        requiredPermission: "resignation:read:all",
      },
      {
        label: "ライフイベントの横断",
        href: "/organization/life-events",
        icon: ClipboardList,
        requiredPermission: "life_event:read:all",
      },
      {
        label: "介護休業の横断",
        href: "/organization/family-care-leaves",
        icon: HeartHandshake,
        requiredPermission: "family_care_leave:read:all",
      },
      {
        label: "出張の横断",
        href: "/organization/business-trips",
        icon: ClipboardList,
        requiredPermission: "business_trip:read:all",
      },
      {
        label: "レンタルの横断",
        href: "/organization/rentals",
        icon: Package,
        requiredPermission: "rental:read:all",
      },
      {
        label: "シフト割当",
        href: "/organization/shift-assignments",
        icon: CalendarDays,
        requiredPermission: "shift:manage",
      },
      {
        label: "シフトパターン",
        href: "/organization/shift-patterns",
        icon: CalendarDays,
        requiredPermission: "shift:manage",
      },
      {
        label: "シフト交代の横断",
        href: "/organization/shift-swaps",
        icon: CalendarDays,
        requiredPermission: "shift_swap:read:all",
      },
      {
        label: "サンクス交換の横断",
        href: "/organization/thanks-redemptions",
        icon: HeartHandshake,
        requiredPermission: "thanks_redemption:read:all",
      },
    ],
  },
]

const systemSections: ReadonlyArray<Section> = [
  {
    heading: null,
    items: [
      {
        label: "ロール",
        href: "/system/roles",
        icon: UserCog,
        requiredPermission: "iam:manage_roles",
      },
      {
        label: "アカウント",
        href: "/system/accounts",
        icon: UserCog,
        requiredPermission: "account:manage",
      },
      {
        label: "監査ログ",
        href: "/system/audit-events",
        icon: ClipboardList,
        requiredPermission: "audit:read",
        prefetch: false,
      },
      {
        label: "ライセンス",
        href: "/system/licenses",
        icon: BookOpenCheck,
        requiredPermission: "license:read:all",
      },
      {
        label: "IT インシデント",
        href: "/system/it-incidents",
        icon: ClipboardList,
        requiredPermission: "it_incident:read:all",
      },
      {
        label: "バッチ",
        href: "/system/batches",
        icon: Wrench,
        requiredPermission: "batch:view",
      },
    ],
  },
]

/**
 * 選択中の部署のセクション。マイチーム（直属の部下）を最上部に置き、
 * 部署メンバーの一覧・目標・勤怠・休暇が続く。目標・勤怠・休暇は部署スコープ permission を持つ場合だけ出す。
 */
function buildTeamSections(teamCode: string): ReadonlyArray<Section> {
  return [
    {
      heading: null,
      items: [
        {
          label: "マイチーム",
          href: "/teams/reports",
          icon: Users,
          requiredAnyPermission: teamScopePermissions,
        },
        {
          label: "代理承認の設定",
          href: "/teams/approval-delegations",
          icon: ClipboardCheck,
          requiredAnyPermission: teamScopePermissions,
        },
      ],
    },
    {
      heading: null,
      items: [
        { label: "メンバー", href: `/teams/${teamCode}/members`, icon: Users },
        {
          label: "目標",
          href: `/teams/${teamCode}/goals`,
          icon: Target,
          requiredAnyPermission: ["goal:read:department", "goal:read:all"],
        },
        {
          label: "勤怠",
          href: `/teams/${teamCode}/attendances`,
          icon: TimerReset,
          requiredAnyPermission: ["attendance:read:department", "attendance:read:all"],
        },
        {
          label: "休暇",
          href: `/teams/${teamCode}/leaves`,
          icon: CalendarOff,
          requiredAnyPermission: ["leave:read:department", "leave:read:all"],
        },
        {
          label: "申請",
          href: `/teams/${teamCode}/applications`,
          icon: FileText,
          requiredAnyPermission: ["application:read:department", "application:read:all"],
        },
        {
          label: "1on1",
          href: `/teams/${teamCode}/oneonones`,
          icon: CalendarClock,
          requiredAnyPermission: ["oneonone:read:department"],
        },
      ],
    },
  ]
}

const SPACE_PREFIXES: ReadonlyArray<{ key: SpaceKey; prefix: string }> = [
  { key: "my", prefix: "/my" },
  { key: "my", prefix: "/inbox" },
  { key: "my", prefix: "/notifications" },
  { key: "teams", prefix: "/teams" },
  { key: "organization", prefix: "/organization" },
  { key: "system", prefix: "/system" },
]

function spaceFromPath(pathname: string): SpaceKey | null {
  for (const entry of SPACE_PREFIXES) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry.key
    }
  }

  return null
}

/** /teams 直下のうち部署コードでない固定ルート。部署 Select の対象にしない。 */
const teamStaticRoutes = new Set(["reports", "approval-delegations", "new"])

function teamCodeFromPath(pathname: string): string | null {
  const matched = pathname.match(/^\/teams\/([^/]+)/)

  if (matched === null) return null

  const segment = decodeURIComponent(matched[1])

  return teamStaticRoutes.has(segment) ? null : segment
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true

  // 空間トップ（マイページ）は配下全体で光らせず、完全一致のみアクティブにする。
  if (item.href === "/my") {
    return false
  }

  return pathname.startsWith(`${item.href}/`)
}

/**
 * 空間タブ（自分 / 部署 / 会社 / システム）を最上部に置き、選んだ空間の項目を
 * セクション見出し付きのフラットな一覧で表示するサイドバーナビ。
 * 部署タブはタブ直下の Select で対象部署を切り替える。受信箱と通知は「自分」に置き、
 * 未処理・未読の合計を「自分」タブのバッジに出す。ホームはヘッダの KARTE ロゴから戻る。
 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()

  const router = useRouter()

  // タブの明示クリックは、その時点のパスに紐づけて保持する。ページ遷移で
  // パスが変わったら、開いたページの空間を自動選択に戻す。
  const [selectedSpace, setSelectedSpace] = useState<{
    space: SpaceKey
    forPath: string
  } | null>(null)

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const activeSpace =
    selectedSpace !== null && selectedSpace.forPath === pathname
      ? selectedSpace.space
      : (spaceFromPath(pathname) ?? selectedSpace?.space ?? "my")

  const permissionSet = new Set(props.permissions)

  // 受信箱バッジは件数 API を持つ 5 種の合計。0 のときは表示しない。
  const inboxTotal =
    props.inboxCounts.applications +
    props.inboxCounts.expenses +
    props.inboxCounts.leaves +
    props.inboxCounts.shifts +
    props.inboxCounts.thanks

  const badgeMap: Record<string, number> = {
    "/inbox": inboxTotal,
    "/notifications": props.unreadNotificationCount,
  }

  const myBadgeTotal = inboxTotal + props.unreadNotificationCount

  // 部署 Select の現在値。URL の部署 → 手動選択 → 主配属 → 全部署の先頭、の順で決める。
  const pathTeam = teamCodeFromPath(pathname)

  const currentTeam =
    pathTeam ??
    selectedTeam ??
    props.myDepartments[0]?.code ??
    props.allDepartments[0]?.code ??
    null

  const myDepartmentCodes = new Set(props.myDepartments.map((department) => department.code))

  const isMyDepartment = currentTeam !== null && myDepartmentCodes.has(currentTeam)

  const currentTeamName =
    currentTeam === null
      ? null
      : (props.myDepartments.find((department) => department.code === currentTeam)?.name ??
        props.allDepartments.find((department) => department.code === currentTeam)?.name ??
        currentTeam)

  const spaces: ReadonlyArray<Space> = [
    { key: "my", label: "自分", icon: User, sections: mySections },
    {
      key: "teams",
      label: "部署",
      icon: Users,
      sections: currentTeam === null ? [] : buildTeamSections(currentTeam),
    },
    { key: "organization", label: "会社", icon: Building2, sections: organizationSections },
    { key: "system", label: "システム", icon: Wrench, sections: systemSections },
  ]

  const visibleSpaces = spaces
    .map((space) => ({
      ...space,
      sections: filterSections(space.sections, permissionSet),
    }))
    .filter((space) => space.sections.length > 0)

  const currentSpace = visibleSpaces.find((space) => space.key === activeSpace) ?? visibleSpaces[0]

  const handleTeamChange = (code: string) => {
    setSelectedTeam(code)

    router.push(`/teams/${code}/members`)
  }

  const renderItem = (item: NavItem) => {
    const Icon = item.icon

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={isItemActive(pathname, item)}
          tooltip={item.label}
          render={<Link href={item.href} prefetch={item.prefetch} />}
        >
          <Icon />
          <span>{item.label}</span>

          {badgeMap[item.href] != null && badgeMap[item.href] > 0 ? (
            <Badge className="ml-auto" aria-label={`未処理 ${badgeMap[item.href]} 件`}>
              {badgeMap[item.href]}
            </Badge>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <div
            role="tablist"
            aria-label="メニューの空間"
            className="grid grid-cols-4 gap-1 rounded-lg bg-sidebar-accent p-1"
          >
            {visibleSpaces.map((space) => {
              const SpaceIcon = space.icon

              return (
                <button
                  key={space.key}
                  type="button"
                  role="tab"
                  aria-selected={space.key === currentSpace?.key}
                  aria-label={space.label}
                  title={space.label}
                  className={
                    space.key === currentSpace?.key
                      ? "relative flex items-center justify-center rounded-md bg-sidebar py-1.5 text-sidebar-foreground shadow-sm"
                      : "relative flex items-center justify-center rounded-md py-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  }
                  onClick={() => setSelectedSpace({ space: space.key, forPath: pathname })}
                >
                  <SpaceIcon className="size-4" />

                  {space.key === "my" && myBadgeTotal > 0 ? (
                    <span
                      aria-label={`未処理と未読 ${myBadgeTotal} 件`}
                      className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
                    >
                      {myBadgeTotal > 9 ? "9+" : myBadgeTotal}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      {currentSpace?.key === "teams" && currentTeam !== null ? (
        <SidebarGroup>
          <SidebarGroupContent>
            {isMyDepartment && props.myDepartments.length >= 1 ? (
              <NativeSelect
                size="sm"
                className="w-full"
                aria-label="自分の部署"
                value={currentTeam}
                onChange={(event) => handleTeamChange(event.target.value)}
              >
                {props.myDepartments.map((department) => (
                  <NativeSelectOption key={department.code} value={department.code}>
                    {department.assignment_type === "primary"
                      ? department.name
                      : `${department.name}（兼務）`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <p className="px-2 text-sm font-medium text-sidebar-foreground">{currentTeamName}</p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      {(currentSpace?.sections ?? []).map((section, index) => (
        <SidebarGroup key={section.heading ?? `section-${index}`}>
          {section.heading !== null ? (
            <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
          ) : null}

          <SidebarGroupContent>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
