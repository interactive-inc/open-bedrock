"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Boxes,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Coins,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Plane,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Workflow,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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
      { label: "キャリア", href: "/career", icon: Briefcase },
      { label: "オンボーディング", href: "/onboarding", icon: ClipboardList },
    ],
  },
  {
    heading: "業務",
    items: [
      { label: "目標", href: "/goals", icon: Target },
      { label: "申請", href: "/applications", icon: Inbox },
      { label: "経費", href: "/expense", icon: Coins },
      { label: "休暇", href: "/leave", icon: Plane },
      { label: "勤怠", href: "/attendance", icon: TimerReset },
    ],
  },
  {
    heading: "コミュニケーション",
    items: [
      { label: "ナレッジ", href: "/knowledge", icon: FileText },
      { label: "サーベイ", href: "/surveys", icon: MessagesSquare },
      { label: "1on1", href: "/oneonone", icon: CalendarClock },
    ],
  },
  {
    heading: "リソース",
    items: [
      { label: "会議室", href: "/rooms", icon: CalendarClock },
      { label: "備品", href: "/assets", icon: Boxes },
    ],
  },
  {
    heading: "システム",
    items: [{ label: "バッチ", href: "/batch", icon: Workflow }],
  },
]

// usePathname でアクティブ状態を判定するため Client Component として切り出したサイドバーナビ。
export function SidebarNav() {
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
