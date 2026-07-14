"use client"

import {
  BookOpen,
  Boxes,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileClock,
  FileText,
  GitBranch,
  GraduationCap,
  HandHelping,
  HeartHandshake,
  Inbox,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  UserMinus,
  Users,
  Wallet,
  Workflow,
  UserCog,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useDeferredValue, useEffect, useState } from "react"
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
  inboxCounts: import("@/lib/api/types/inbox-types").InboxCounts
  unreadNotificationCount: number
  // 本人が持つ permission キー。これに含まれる requiredPermission の項目だけ表示する。
  permissions: ReadonlyArray<string>
}

type SubItem = {
  label: string
  href: string
  requiredPermission?: string
  prefetch?: boolean
}

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  prefetch?: boolean
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
    const items = group.items.reduce<Array<NavItem>>((result, item) => {
      if (allowed(item.requiredPermission) === false) {
        return result
      }

      const filteredItem = {
        ...item,
        children: item.children?.filter((child) => allowed(child.requiredPermission)),
      }

      if (filteredItem.children === undefined || filteredItem.children.length > 0) {
        result.push(filteredItem)
      }

      return result
    }, [])

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
    heading: "人材",
    items: [
      {
        label: "従業員",
        href: "/employees",
        icon: Users,
        children: [
          { label: "一覧", href: "/employees", requiredPermission: "employee:read" },
          { label: "新規登録", href: "/employees/new", requiredPermission: "employee:create" },
        ],
      },
      {
        label: "組織",
        href: "/org",
        icon: GitBranch,
        children: [
          { label: "概要", href: "/org" },
          { label: "部署", href: "/org/departments", requiredPermission: "org:manage" },
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
        label: "オンボーディング",
        href: "/onboarding",
        icon: ClipboardList,
        children: [
          { label: "ハブ", href: "/onboarding", requiredPermission: "onboarding:manage" },
          {
            label: "社員別の状況",
            href: "/onboarding/employees",
            requiredPermission: "onboarding:view:all",
          },
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
    heading: "業務",
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
        label: "申請",
        href: "/applications",
        icon: FileText,
        children: [
          { label: "自分の申請", href: "/applications" },
          {
            label: "受信箱",
            href: "/applications/inbox",
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
        label: "予算",
        href: "/budgets",
        icon: Wallet,
        requiredPermission: "budget:manage",
        children: [
          { label: "一覧", href: "/budgets", requiredPermission: "budget:manage" },
          { label: "新規", href: "/budgets/new", requiredPermission: "budget:manage" },
          { label: "消化状況", href: "/budgets/summary", requiredPermission: "budget:manage" },
        ],
      },
      {
        label: "休暇",
        href: "/leave",
        icon: CalendarOff,
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
        label: "勤怠",
        href: "/attendance",
        icon: TimerReset,
        children: [
          { label: "自分", href: "/attendance" },
          { label: "全員", href: "/attendance/all", requiredPermission: "attendance:read:all" },
        ],
      },
      {
        label: "シフト",
        href: "/shift",
        icon: CalendarDays,
        children: [
          { label: "自分", href: "/shift" },
          {
            label: "交代承認",
            href: "/shift/inbox",
            requiredPermission: "shift_swap:approve",
          },
          { label: "パターン", href: "/shift/patterns", requiredPermission: "shift:manage" },
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
    heading: "コミュニケーション",
    items: [
      {
        label: "ナレッジ",
        href: "/knowledge",
        icon: BookOpen,
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
        label: "1on1",
        href: "/oneonone",
        icon: CalendarClock,
        children: [
          { label: "履歴", href: "/oneonone" },
          { label: "記録を追加", href: "/oneonone/new", requiredPermission: "oneonone:create" },
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
            label: "交換承認",
            href: "/thanks/inbox",
            requiredPermission: "thanks_redemption:approve",
          },
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
    ],
  },
  {
    heading: "リソース",
    items: [
      {
        label: "会議室",
        href: "/rooms",
        icon: DoorOpen,
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
        label: "レンタル",
        href: "/rentals",
        icon: Package,
        children: [
          { label: "一覧", href: "/rentals" },
          { label: "新規予約", href: "/rentals/new" },
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
          { label: "保有状況", href: "/assets/holdings", requiredPermission: "asset:manage" },
          { label: "棚卸し", href: "/stocktakes", requiredPermission: "asset:manage" },
        ],
      },
    ],
  },
  {
    heading: "依頼",
    items: [
      {
        label: "証明書",
        href: "/certificate-requests",
        icon: ScrollText,
        children: [
          { label: "自分の依頼", href: "/certificate-requests" },
          { label: "新規依頼", href: "/certificate-requests/new" },
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
        label: "介護休業",
        href: "/family-care-leaves",
        icon: HandHelping,
        children: [
          { label: "一覧", href: "/family-care-leaves" },
          { label: "新規申請", href: "/family-care-leaves/new" },
        ],
      },
      {
        label: "ライフイベント",
        href: "/life-events",
        icon: PartyPopper,
        children: [
          { label: "一覧", href: "/life-events" },
          { label: "新規登録", href: "/life-events/new" },
        ],
      },
      {
        label: "退職届",
        href: "/resignations",
        icon: UserMinus,
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
          { label: "新規申請", href: "/antisocial-checks/new" },
          {
            label: "判定受信箱",
            href: "/antisocial-checks/admin",
            requiredPermission: "antisocial_check:manage",
          },
        ],
      },
    ],
  },
  {
    heading: "システム",
    items: [
      {
        label: "監査ログ",
        href: "/admin/audit-events",
        icon: FileClock,
        requiredPermission: "audit:read",
        prefetch: false,
      },
      { label: "バッチ", href: "/batch", icon: Workflow, requiredPermission: "batch:view" },
      {
        label: "ロール管理",
        href: "/admin/roles",
        icon: KeyRound,
        requiredPermission: "iam:manage_roles",
      },
      {
        label: "アカウント管理",
        href: "/admin/accounts",
        icon: UserCog,
        requiredPermission: "account:manage",
      },
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

/** テキスト中の query にマッチする部分を <mark> で囲んで返す。 */
function HighlightText(props: { text: string; query: string }) {
  if (props.query === "") return <>{props.text}</>

  const lowerText = props.text.toLowerCase()

  const lowerQuery = props.query.toLowerCase()

  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return <>{props.text}</>

  const before = props.text.slice(0, index)

  const match = props.text.slice(index, index + props.query.length)

  const after = props.text.slice(index + props.query.length)

  return (
    <>
      {before}
      <mark className="rounded-sm bg-yellow-200/60 text-inherit dark:bg-yellow-500/30">
        {match}
      </mark>
      {after}
    </>
  )
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

const SIDEBAR_EXPANDED_KEY = "sidebar-expanded"

/**
 * localStorage にアコーディオンの展開状態を保存・復元する。
 * アクティブな項目は常に展開し、ユーザーが手動で開閉した状態をページ遷移後も維持する。
 */
function useExpandedState(pathname: string) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY)

      if (stored !== null) {
        setExpanded(new Set(JSON.parse(stored)))
      }
    } catch {
      // localStorage が使えない場合は空 Set のまま
    }

    setInitialized(true)
  }, [])

  const toggle = useCallback((href: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev)

      if (open) {
        next.add(href)
      } else {
        next.delete(href)
      }

      try {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify([...next]))
      } catch {
        // localStorage が使えない場合は無視
      }

      return next
    })
  }, [])

  const isExpanded = useCallback(
    (item: NavItem): boolean => {
      // まだ localStorage を読み込んでいない初期状態ではアクティブなもののみ展開
      if (!initialized) return isParentActive(pathname, item)

      // アクティブなアイテムは常に展開
      if (isParentActive(pathname, item)) return true

      // localStorage に保存された状態を使用
      return expanded.has(item.href)
    },
    [expanded, initialized, pathname],
  )

  return { isExpanded, toggle }
}

/**
 * オブジェクト軸でグループ化したサイドバーナビ。各オブジェクトの CRUD を Collapsible で展開する。
 * 入力でメニューを絞り込み、現在のパスを含む親は自動で開いた状態にする。
 * アコーディオンの展開状態は localStorage に保持し、ページ遷移・リロード後も維持される。
 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()

  const [filterQuery, setFilterQuery] = useState("")

  const deferredQuery = useDeferredValue(filterQuery)

  const isStale = filterQuery !== deferredQuery

  const visibleGroups = filterGroups(deferredQuery, props.permissions)

  const highlightQuery = deferredQuery.trim().toLowerCase()

  const { isExpanded, toggle } = useExpandedState(pathname)

  // 受信箱パスごとの未処理件数マップ。0 の項目にはバッジを表示しない。
  const inboxBadgeMap: Record<string, number> = {
    "/applications/inbox": props.inboxCounts.applications,
    "/expense/inbox": props.inboxCounts.expenses,
    "/leave/inbox": props.inboxCounts.leaves,
    "/shift/inbox": props.inboxCounts.shifts,
    "/thanks/inbox": props.inboxCounts.thanks,
  }

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

      <div className={isStale ? "opacity-60 transition-opacity duration-200" : undefined}>
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
                          render={<Link href={item.href} prefetch={item.prefetch} />}
                        >
                          <Icon />
                          <span>
                            <HighlightText text={item.label} query={highlightQuery} />
                          </span>

                          {item.href === "/notifications" && props.unreadNotificationCount > 0 ? (
                            <Badge
                              className="ml-auto"
                              aria-label={`未読 ${props.unreadNotificationCount} 件`}
                            >
                              {props.unreadNotificationCount}
                            </Badge>
                          ) : null}

                          {inboxBadgeMap[item.href] != null && inboxBadgeMap[item.href] > 0 ? (
                            <Badge
                              variant="secondary"
                              className="ml-auto"
                              aria-label={`未処理 ${inboxBadgeMap[item.href]} 件`}
                            >
                              {inboxBadgeMap[item.href]}
                            </Badge>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <Collapsible
                      key={item.href}
                      open={isExpanded(item)}
                      onOpenChange={(open) => toggle(item.href, open)}
                      render={<SidebarMenuItem />}
                    >
                      <CollapsibleTrigger
                        render={
                          <SidebarMenuButton tooltip={item.label} isActive={parentActive}>
                            <Icon />
                            <span>
                              <HighlightText text={item.label} query={highlightQuery} />
                            </span>
                            <ChevronDown className="ml-auto size-4 transition-transform group-data-[open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        }
                      />

                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {(item.children ?? []).map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                isActive={isSubItemActive(pathname, child.href)}
                                render={<Link href={child.href} prefetch={child.prefetch} />}
                              >
                                <ChevronRight className="size-3 shrink-0 text-sidebar-foreground/50" />
                                <span>
                                  <HighlightText text={child.label} query={highlightQuery} />
                                </span>

                                {inboxBadgeMap[child.href] != null &&
                                inboxBadgeMap[child.href] > 0 ? (
                                  <Badge
                                    variant="secondary"
                                    className="ml-auto"
                                    aria-label={`未処理 ${inboxBadgeMap[child.href]} 件`}
                                  >
                                    {inboxBadgeMap[child.href]}
                                  </Badge>
                                ) : null}
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
      </div>

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
