"use client"

import { Building2, Circle, type LucideIcon, User, Users, Wrench } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { featureStatusLabels, featureTierLabels } from "@/lib/feature/feature-registry"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"
import { getFeatureNavigationSections } from "@/lib/feature/get-feature-navigation-sections"
import type { FeatureNavigationItem, FeatureNavigationSection } from "@/lib/feature/feature-types"
import type { FlatDepartment } from "@/lib/org/flatten-org-tree"
import { cn } from "@/lib/utils"

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

type SpaceKey = "my" | "teams" | "organization" | "system"

type Space = {
  key: SpaceKey
  label: string
  icon: LucideIcon
  sections: ReadonlyArray<FeatureNavigationSection>
}

function isAllowed(
  navigationItem: FeatureNavigationItem,
  permissions: ReadonlySet<string>,
): boolean {
  if (navigationItem.visibility.kind === "everyone") return true

  if (navigationItem.visibility.kind === "permission") {
    return permissions.has(navigationItem.visibility.permission)
  }

  if (navigationItem.visibility.kind === "any-permission") {
    return navigationItem.visibility.permissions.some((permission) => permissions.has(permission))
  }

  return navigationItem.visibility.permissions.every((permission) => permissions.has(permission))
}

/**
 * permission を持つ項目だけに絞り込み、空になったセクションは畳む。
 */
function filterSections(
  sections: ReadonlyArray<FeatureNavigationSection>,
  permissions: ReadonlySet<string>,
): ReadonlyArray<FeatureNavigationSection> {
  const filteredSections: Array<FeatureNavigationSection> = []

  for (const section of sections) {
    const visibleItems = section.items.filter((navigationItem) =>
      isAllowed(navigationItem, permissions),
    )

    if (visibleItems.length === 0) continue

    filteredSections.push({ heading: section.heading, items: visibleItems })
  }

  return filteredSections
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

/**
 * /teams 直下のうち部署コードでない固定ルート。部署 Select の対象にしない。
 */
const teamStaticRoutes = new Set(["reports", "approval-delegations", "new"])

function teamCodeFromPath(pathname: string): string | null {
  const matched = pathname.match(/^\/teams\/([^/]+)/)

  if (matched === null) return null

  const segment = decodeURIComponent(matched[1])

  return teamStaticRoutes.has(segment) ? null : segment
}

function isItemActive(pathname: string, item: FeatureNavigationItem): boolean {
  if (pathname === item.href) return true

  // 空間トップ（マイページ）は配下全体で光らせず、完全一致のみアクティブにする。
  if (item.href === "/my") {
    return false
  }

  return pathname.startsWith(`${item.href}/`)
}

/**
 * 空間タブ（自分 / 部署 / 会社 / システム）を最上部に置き、選んだ空間の項目を
 * 機能レジストリのグループ別に表示するサイドバーナビ。
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
    {
      key: "my",
      label: "自分",
      icon: User,
      sections: getFeatureNavigationSections(getFeatureNavigationItems("my", null)),
    },
    {
      key: "teams",
      label: "部署",
      icon: Users,
      sections: getFeatureNavigationSections(getFeatureNavigationItems("teams", currentTeam)),
    },
    {
      key: "organization",
      label: "会社",
      icon: Building2,
      sections: getFeatureNavigationSections(getFeatureNavigationItems("organization", null)),
    },
    {
      key: "system",
      label: "システム",
      icon: Wrench,
      sections: getFeatureNavigationSections(getFeatureNavigationItems("system", null)),
    },
  ]

  const visibleSpaces: Array<Space> = []

  for (const space of spaces) {
    const sections = filterSections(space.sections, permissionSet)

    if (sections.length === 0) {
      continue
    }

    visibleSpaces.push({
      key: space.key,
      label: space.label,
      icon: space.icon,
      sections,
    })
  }

  const currentSpace = visibleSpaces.find((space) => space.key === activeSpace) ?? visibleSpaces[0]

  const handleTeamChange = (code: string) => {
    setSelectedTeam(code)

    router.push(`/teams/${code}/members`)
  }

  const renderItem = (item: FeatureNavigationItem) => {
    const Icon = item.icon

    const classification = `${featureTierLabels[item.tier]}・${featureStatusLabels[item.status]}`

    return (
      <SidebarMenuItem
        key={item.href}
        data-feature={item.slug}
        data-feature-tier={item.tier}
        data-feature-status={item.status}
      >
        <SidebarMenuButton
          isActive={isItemActive(pathname, item)}
          tooltip={`${item.label}・${classification}`}
          render={
            <Link
              href={item.href}
              prefetch={item.prefetch ?? undefined}
              aria-label={item.label}
              aria-description={classification}
              title={classification}
            />
          }
        >
          <Icon
            aria-hidden="true"
            className={cn(item.status === "development" && "text-feature-development")}
          />
          <span className="truncate">{item.label}</span>

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
          <div className="flex flex-col gap-2">
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
                    className={cn(
                      "relative flex items-center justify-center rounded-md py-1.5 text-sidebar-foreground",
                      space.key === currentSpace?.key
                        ? "bg-sidebar shadow-sm"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
                    )}
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

            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Badge variant="outline">
                <Circle
                  data-icon="inline-start"
                  className="fill-feature-development text-feature-development"
                />
                開発中
              </Badge>
              <span>琥珀色のアイコン</span>
            </div>
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

      {(currentSpace?.sections ?? []).map((section) => (
        <SidebarGroup key={section.heading}>
          <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
