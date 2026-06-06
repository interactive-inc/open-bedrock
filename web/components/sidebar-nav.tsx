"use client"

import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Boxes,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileText,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Plane,
  ReceiptText,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Wallet,
  Workflow,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type Props = {
  unreadNotificationCount: number
}

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

type NavGroup = {
  heading: string
  items: ReadonlyArray<NavItem>
}

// 設計の 20 ドメインをグループ分けしたサイドバーナビ定義。href は (app) 配下のパスに合わせる。
const navGroups: ReadonlyArray<NavGroup> = [
  {
    heading: "ホーム",
    items: [{ label: "ダッシュボード", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "人材",
    items: [
      { label: "従業員", href: "/employees", icon: Users },
      { label: "組織", href: "/org", icon: GitBranch },
      { label: "スキル", href: "/skills", icon: Sparkles },
      { label: "研修", href: "/training", icon: GraduationCap },
      { label: "キャリア", href: "/career", icon: Briefcase },
      { label: "オンボーディング", href: "/onboarding", icon: ClipboardList },
    ],
  },
  {
    heading: "業務",
    items: [
      { label: "目標", href: "/goals", icon: Target },
      { label: "評価", href: "/review", icon: ClipboardCheck },
      { label: "申請", href: "/applications", icon: Inbox },
      { label: "経費", href: "/expense", icon: Coins },
      { label: "休暇", href: "/leave", icon: Plane },
      { label: "勤怠", href: "/attendance", icon: TimerReset },
      { label: "シフト", href: "/shift", icon: CalendarDays },
    ],
  },
  {
    heading: "お金",
    items: [
      { label: "給与明細", href: "/payroll", icon: ReceiptText },
      { label: "給与管理", href: "/payroll/admin", icon: Wallet },
    ],
  },
  {
    heading: "コミュニケーション",
    items: [
      { label: "ナレッジ", href: "/knowledge", icon: FileText },
      { label: "サーベイ", href: "/surveys", icon: MessagesSquare },
      { label: "1on1", href: "/oneonone", icon: CalendarClock },
      { label: "感謝", href: "/thanks", icon: HeartHandshake },
    ],
  },
  {
    heading: "リソース",
    items: [
      { label: "会議室", href: "/rooms", icon: CalendarClock },
      { label: "レンタル", href: "/rentals", icon: Package },
      { label: "備品", href: "/assets", icon: Boxes },
    ],
  },
  {
    heading: "システム",
    items: [
      { label: "バッチ", href: "/batch", icon: Workflow },
      { label: "通知", href: "/notifications", icon: Bell },
    ],
  },
]

// usePathname でアクティブ状態を判定するため Client Component として切り出したサイドバーナビ。
// 通知メニューには未読件数の Badge を添える。
export function SidebarNav(props: Props) {
  const pathname = usePathname()

  return (
    <>
      {navGroups.map((group) => (
        <SidebarGroup key={group.heading}>
          <SidebarGroupLabel>{group.heading}</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>

                      {item.href === "/notifications" && props.unreadNotificationCount > 0 ? (
                        <Badge className="ml-auto">{props.unreadNotificationCount}</Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
