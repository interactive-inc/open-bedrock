"use client"

import {
  Award,
  Bell,
  Boxes,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileText,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Package,
  Plane,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Workflow,
  UserCog,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type Props = {
  unreadNotificationCount: number
  // 本人が持つ permission キー。これに含まれる requiredPermission の項目だけ表示する。
  permissions: ReadonlyArray<string>
}

type SubItem = {
  label: string
  href: string
  requiredPermission?: string
}

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  children?: ReadonlyArray<SubItem>
}

type NavGroup = {
  heading: string
  items: ReadonlyArray<NavItem>
}

// permission を持つ項目だけに絞り込む。requiredPermission 未指定は全員に表示。
// children が全て除外された親、items が空になった group は畳む。
function filterByPermission(
  groups: ReadonlyArray<NavGroup>,
  permissions: ReadonlySet<string>,
): ReadonlyArray<NavGroup> {
  const allowed = (required: string | undefined): boolean =>
    required === undefined || permissions.has(required)

  const filteredGroups = groups.map((group) => {
    const items = group.items
      .filter((item) => allowed(item.requiredPermission))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => allowed(child.requiredPermission)),
      }))

    return { ...group, items: items }
  })

  return filteredGroups.filter((group) => group.items.length > 0)
}

const navGroups: ReadonlyArray<NavGroup> = [
  {
    heading: "ホーム",
    items: [{ label: "ホーム", href: "/", icon: LayoutDashboard }],
  },
  {
    heading: "受信箱",
    items: [
      {
        label: "申請の承認",
        href: "/applications/inbox",
        icon: Inbox,
        requiredPermission: "application:approve",
      },
      {
        label: "経費の承認",
        href: "/expense/inbox",
        icon: Inbox,
        requiredPermission: "expense:approve",
      },
      {
        label: "休暇の承認",
        href: "/leave/inbox",
        icon: Inbox,
        requiredPermission: "leave:approve",
      },
    ],
  },
  {
    heading: "申請",
    items: [
      {
        label: "申請",
        href: "/applications",
        icon: FileText,
        children: [
          { label: "自分の申請", href: "/applications" },
          {
            label: "受信箱",
            href: "/applications/inbox",
            requiredPermission: "application:approve",
          },
          {
            label: "全社の申請",
            href: "/applications/admin",
            requiredPermission: "application:read:all",
          },
          {
            label: "テンプレート",
            href: "/applications/templates",
            requiredPermission: "application_template:manage",
          },
          {
            label: "新規テンプレート",
            href: "/applications/templates/new",
            requiredPermission: "application_template:manage",
          },
        ],
      },
      {
        label: "経費",
        href: "/expense",
        icon: Coins,
        children: [
          { label: "一覧", href: "/expense" },
          { label: "新規", href: "/expense/new" },
          { label: "受信箱", href: "/expense/inbox", requiredPermission: "expense:approve" },
          {
            label: "全社の経費",
            href: "/expense/admin",
            requiredPermission: "expense:read:all",
          },
        ],
      },
      {
        label: "出張",
        href: "/business-trips",
        icon: Plane,
        children: [
          { label: "一覧", href: "/business-trips" },
          { label: "新規申請", href: "/business-trips/new" },
        ],
      },
      {
        label: "証明書",
        href: "/certificate-requests",
        icon: FileText,
        children: [
          { label: "自分の依頼", href: "/certificate-requests" },
          { label: "新規依頼", href: "/certificate-requests/new" },
        ],
      },
      {
        label: "ライフイベント",
        href: "/life-events",
        icon: ClipboardList,
        children: [
          { label: "一覧", href: "/life-events" },
          { label: "新規登録", href: "/life-events/new" },
        ],
      },
      {
        label: "介護休業",
        href: "/family-care-leaves",
        icon: HeartHandshake,
        children: [
          { label: "一覧", href: "/family-care-leaves" },
          { label: "新規申請", href: "/family-care-leaves/new" },
        ],
      },
      {
        label: "退職届",
        href: "/resignations",
        icon: FileText,
        children: [
          { label: "一覧", href: "/resignations" },
          { label: "新規申請", href: "/resignations/new" },
        ],
      },
      {
        label: "反社チェック",
        href: "/antisocial-checks",
        icon: ShieldCheck,
        children: [
          { label: "一覧", href: "/antisocial-checks" },
          { label: "新規宣誓", href: "/antisocial-checks/new" },
        ],
      },
    ],
  },
  {
    heading: "勤怠と休暇",
    items: [
      {
        label: "勤怠",
        href: "/attendance",
        icon: TimerReset,
        children: [
          { label: "自分", href: "/attendance" },
          { label: "全員", href: "/attendance/all", requiredPermission: "attendance:read:all" },
        ],
      },
      {
        label: "休暇",
        href: "/leave",
        icon: Plane,
        children: [
          { label: "一覧", href: "/leave" },
          { label: "新規", href: "/leave/new" },
          { label: "受信箱", href: "/leave/inbox", requiredPermission: "leave:approve" },
          {
            label: "全社の休暇",
            href: "/leave/admin",
            requiredPermission: "leave:read:all",
          },
        ],
      },
      {
        label: "シフト",
        href: "/shift",
        icon: CalendarDays,
        children: [
          { label: "自分", href: "/shift" },
          { label: "パターン", href: "/shift/patterns" },
          { label: "管理", href: "/shift/manage", requiredPermission: "shift:manage" },
          {
            label: "全社の交代",
            href: "/shift/admin",
            requiredPermission: "shift_swap:read:all",
          },
        ],
      },
    ],
  },
  {
    heading: "人と組織",
    items: [
      {
        label: "従業員",
        href: "/employees",
        icon: Users,
        children: [
          { label: "一覧", href: "/employees" },
          { label: "新規登録", href: "/employees/new", requiredPermission: "employee:create" },
        ],
      },
      {
        label: "組織",
        href: "/org",
        icon: GitBranch,
        children: [
          { label: "概要", href: "/org" },
          { label: "部署", href: "/org/departments" },
        ],
      },
      { label: "等級", href: "/grades", icon: Award },
    ],
  },
  {
    heading: "成長と評価",
    items: [
      {
        label: "目標",
        href: "/goals",
        icon: Target,
        children: [
          { label: "一覧", href: "/goals" },
          { label: "新規", href: "/goals/new" },
        ],
      },
      {
        label: "評価",
        href: "/review",
        icon: ClipboardCheck,
        children: [
          { label: "サイクル", href: "/review" },
          { label: "管理", href: "/review/manage", requiredPermission: "review:administer" },
        ],
      },
      {
        label: "スキル",
        href: "/skills",
        icon: Sparkles,
        children: [
          { label: "一覧", href: "/skills" },
          { label: "自分のスキル", href: "/skills/me" },
        ],
      },
      {
        label: "研修",
        href: "/training",
        icon: GraduationCap,
        children: [
          { label: "コース一覧", href: "/training" },
          { label: "自分の受講", href: "/training/me" },
          { label: "新規コース", href: "/training/new", requiredPermission: "training:manage" },
        ],
      },
      {
        label: "キャリア",
        href: "/career",
        icon: Briefcase,
        children: [
          { label: "マイキャリア", href: "/career" },
          { label: "社内公募", href: "/career/postings" },
          {
            label: "新規公募",
            href: "/career/postings/new",
            requiredPermission: "career_posting:manage",
          },
        ],
      },
      {
        label: "1on1",
        href: "/oneonone",
        icon: CalendarClock,
        children: [
          { label: "履歴", href: "/oneonone" },
          { label: "記録を追加", href: "/oneonone/new" },
        ],
      },
      {
        label: "オンボーディング",
        href: "/onboarding",
        icon: ClipboardList,
        children: [
          { label: "ハブ", href: "/onboarding", requiredPermission: "onboarding:manage" },
          {
            label: "テンプレート",
            href: "/onboarding/templates",
            requiredPermission: "onboarding:manage",
          },
          {
            label: "新規テンプレート",
            href: "/onboarding/templates/new",
            requiredPermission: "onboarding:manage",
          },
          {
            label: "新規割当",
            href: "/onboarding/assignments/new",
            requiredPermission: "onboarding:manage",
          },
          { label: "自分のタスク", href: "/onboarding/me" },
        ],
      },
    ],
  },
  {
    heading: "情報",
    items: [
      {
        label: "ナレッジ",
        href: "/knowledge",
        icon: FileText,
        children: [
          { label: "一覧", href: "/knowledge" },
          { label: "新規", href: "/knowledge/new" },
        ],
      },
      {
        label: "サーベイ",
        href: "/surveys",
        icon: MessagesSquare,
        children: [
          { label: "回答する", href: "/surveys" },
          { label: "管理", href: "/surveys/manage", requiredPermission: "survey:manage" },
          {
            label: "新規アンケート",
            href: "/surveys/manage/new",
            requiredPermission: "survey:manage",
          },
        ],
      },
      {
        label: "感謝",
        href: "/thanks",
        icon: HeartHandshake,
        children: [
          { label: "タイムライン", href: "/thanks" },
          { label: "送る", href: "/thanks/send" },
          { label: "景品", href: "/thanks/rewards" },
          {
            label: "景品の管理",
            href: "/thanks/rewards/manage",
            requiredPermission: "thanks_reward:manage",
          },
          {
            label: "全社の交換",
            href: "/thanks/admin",
            requiredPermission: "thanks_redemption:read:all",
          },
        ],
      },
      { label: "通知", href: "/notifications", icon: Bell },
    ],
  },
  {
    heading: "物と場所",
    items: [
      {
        label: "会議室",
        href: "/rooms",
        icon: CalendarClock,
        children: [
          { label: "空き状況", href: "/rooms" },
          { label: "自分の予約", href: "/rooms/me" },
          { label: "マスタ", href: "/rooms/manage", requiredPermission: "room:manage" },
          {
            label: "会議室を登録",
            href: "/rooms/manage/new",
            requiredPermission: "room:manage",
          },
        ],
      },
      {
        label: "備品",
        href: "/assets",
        icon: Boxes,
        children: [
          { label: "一覧", href: "/assets" },
          { label: "新規登録", href: "/assets/new", requiredPermission: "asset:manage" },
          { label: "自分の貸与品", href: "/assets/lent/me" },
        ],
      },
      {
        label: "レンタル",
        href: "/rentals",
        icon: Package,
        children: [
          { label: "一覧", href: "/rentals" },
          { label: "新規予約", href: "/rentals/new" },
        ],
      },
    ],
  },
  {
    heading: "管理",
    items: [
      {
        label: "ロール管理",
        href: "/admin/roles",
        icon: ShieldCheck,
        requiredPermission: "iam:manage_roles",
      },
      {
        label: "アカウント管理",
        href: "/admin/accounts",
        icon: UserCog,
        requiredPermission: "account:manage",
      },
      {
        label: "監査ログ",
        href: "/admin/audit-logs",
        icon: ScrollText,
        requiredPermission: "audit_log:read",
      },
      {
        label: "労務の横断閲覧",
        href: "/certificate-requests/admin",
        icon: ClipboardList,
        children: [
          {
            label: "証明書発行",
            href: "/certificate-requests/admin",
            requiredPermission: "certificate_request:read:all",
          },
          {
            label: "退職手続き",
            href: "/resignations/admin",
            requiredPermission: "resignation:read:all",
          },
          {
            label: "ライフイベント",
            href: "/life-events/admin",
            requiredPermission: "life_event:read:all",
          },
          {
            label: "産休・育休・介護",
            href: "/family-care-leaves/admin",
            requiredPermission: "family_care_leave:read:all",
          },
          {
            label: "出張",
            href: "/business-trips/admin",
            requiredPermission: "business_trip:read:all",
          },
          {
            label: "貸与品予約",
            href: "/rentals/admin",
            requiredPermission: "rental:read:all",
          },
        ],
      },
      { label: "バッチ", href: "/batch", icon: Workflow, requiredPermission: "batch:view" },
    ],
  },
]

function matchesQuery(item: NavItem, query: string): boolean {
  if (item.label.toLowerCase().includes(query)) return true

  if (item.children !== undefined) {
    for (const child of item.children) {
      if (child.label.toLowerCase().includes(query)) return true
    }
  }

  return false
}

function filterGroups(query: string, permissions: ReadonlyArray<string>): ReadonlyArray<NavGroup> {
  const allowedGroups = filterByPermission(navGroups, new Set(permissions))

  const trimmed = query.trim().toLowerCase()

  if (trimmed === "") return allowedGroups

  const filtered: NavGroup[] = []

  for (const group of allowedGroups) {
    const items = group.items.filter((item) => matchesQuery(item, trimmed))

    if (items.length > 0) {
      filtered.push({ heading: group.heading, items })
    }
  }

  return filtered
}

function isSubItemActive(pathname: string, href: string): boolean {
  return pathname === href
}

function isParentActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true

  if (item.children !== undefined) {
    for (const child of item.children) {
      if (pathname === child.href) return true
    }
  }

  return pathname.startsWith(`${item.href}/`)
}

/**
 * コアの業務領域（申請・時間・人・成長）を上、補足領域（情報・物と場所）を下、管理を最後に並べたサイドバーナビ。
 * 各項目の詳細ページは Collapsible で展開する。入力でメニューを絞り込み、現在のパスを含む親は自動で開いた状態にする。
 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()

  const [filterQuery, setFilterQuery] = useState("")

  const visibleGroups = filterGroups(filterQuery, props.permissions)

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              type="search"
              placeholder="メニューを検索"
              className="h-8 pl-8"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              aria-label="メニューを検索"
            />
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      {visibleGroups.map((group) => (
        <SidebarGroup key={group.heading}>
          <SidebarGroupLabel>{group.heading}</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon

                const hasChildren = item.children !== undefined && item.children.length > 0

                const parentActive = isParentActive(pathname, item)

                if (!hasChildren) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={parentActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <Icon />
                        <span>{item.label}</span>

                        {item.href === "/notifications" && props.unreadNotificationCount > 0 ? (
                          <Badge
                            className="ml-auto"
                            aria-label={`未読 ${props.unreadNotificationCount} 件`}
                          >
                            {props.unreadNotificationCount}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <Collapsible
                    key={`${item.href}:${parentActive}`}
                    defaultOpen={parentActive}
                    render={<SidebarMenuItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton tooltip={item.label} isActive={parentActive}>
                          <Icon />
                          <span>{item.label}</span>
                          <ChevronDown className="ml-auto size-4 transition-transform group-data-[panel-open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      }
                    />

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {(item.children ?? []).map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton
                              isActive={isSubItemActive(pathname, child.href)}
                              render={<Link href={child.href} />}
                            >
                              <span>{child.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}

      {visibleGroups.length === 0 ? (
        <SidebarGroup>
          <SidebarGroupContent>
            <p className="px-2 py-1 text-xs text-muted-foreground">
              「{filterQuery}」に一致するメニューはありません
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  )
}
