"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FeatureSpace } from "@/lib/feature/feature-types"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"
import { getFeatureNavigationSections } from "@/lib/feature/get-feature-navigation-sections"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"
import { Blocks, Building2, Wrench } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

type Props = {
  permissions: ReadonlyArray<string>
  disabledFeatures: ReadonlyArray<string>
}

const spaces = [
  { key: "system", label: "システム", icon: Wrench },
  { key: "company", label: "会社", icon: Building2 },
  { key: "apps", label: "業務", icon: Blocks },
] as const

/** 所有区分と実効権限で管理対象を表示する。本人や所属部署をナビゲーションに使わない。 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()
  const [selection, setSelection] = useState<{ space: FeatureSpace; path: string } | null>(null)
  const items = getAdminNavigationItems(props.permissions, props.disabledFeatures)
  const visibleSpaces = spaces.filter((space) =>
    items.some((item) => toFeatureSpace(item.href) === space.key),
  )
  const selected = selection?.path === pathname ? selection.space : toFeatureSpace(pathname)
  const current = visibleSpaces.find((space) => space.key === selected) ?? visibleSpaces[0]
  const sections = getFeatureNavigationSections(
    items.filter((item) => toFeatureSpace(item.href) === current?.key),
  )

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <Tabs
            value={current?.key}
            onValueChange={(value) => {
              if (value === "system" || value === "company" || value === "apps")
                setSelection({ space: value, path: pathname })
            }}
          >
            <TabsList aria-label="管理メニュー" className="flex w-full">
              {visibleSpaces.map((space) => (
                <TabsTrigger
                  key={space.key}
                  value={space.key}
                  aria-label={space.label}
                  title={space.label}
                >
                  <space.icon aria-hidden="true" />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </SidebarGroupContent>
      </SidebarGroup>
      {sections.map((section) => (
        <SidebarGroup key={section.heading}>
          <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href} data-feature={item.slug}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.label}
                    render={
                      <Link
                        href={item.href}
                        prefetch={item.prefetch ?? undefined}
                        aria-label={item.label}
                      />
                    }
                  >
                    <item.icon aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
