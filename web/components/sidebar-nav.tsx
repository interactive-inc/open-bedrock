"use client"

import {
  SidebarContent,
  SidebarHeader,
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
import { Blocks, Building2, Network, Wrench } from "lucide-react"
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
  { key: "composition", label: "横断", icon: Network },
  { key: "apps", label: "業務", icon: Blocks },
] as const

/** 所有区分と実効権限で管理対象を表示する。本人や所属部署をナビゲーションに使わない。 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()
  const [selection, setSelection] = useState<{ space: FeatureSpace; path: string } | null>(null)
  const items = getAdminNavigationItems(props.permissions, props.disabledFeatures)
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .toSorted((left, right) => right.href.length - left.href.length)[0]?.href
  const visibleSpaces = spaces.filter((space) =>
    items.some((item) => toFeatureSpace(item.href) === space.key),
  )
  const selected = selection?.path === pathname ? selection.space : toFeatureSpace(pathname)
  const current = visibleSpaces.find((space) => space.key === selected) ?? visibleSpaces[0]
  const sections = getFeatureNavigationSections(
    items.filter((item) => toFeatureSpace(item.href) === current?.key),
  )
  const menuSections =
    current?.key === "composition"
      ? [
          {
            group: "cross-context",
            heading: null,
            items: sections.flatMap((section) => section.items),
          },
        ]
      : sections

  return (
    <>
      <SidebarHeader>
        <div className="px-2">
          <span className="text-base font-semibold tracking-wider">
            {process.env.NEXT_PUBLIC_APP_NAME ?? "BEDROCK"}
          </span>
        </div>
        <SidebarGroupContent>
          <Tabs
            value={current?.key}
            onValueChange={(value) => {
              if (
                value === "system" ||
                value === "company" ||
                value === "apps" ||
                value === "composition"
              )
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
      </SidebarHeader>
      <SidebarContent>
        {menuSections.map((section) => (
          <SidebarGroup key={section.group}>
            {section.heading !== null ? (
              <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href} data-feature={item.slug}>
                    <SidebarMenuButton
                      isActive={item.href === activeHref}
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
      </SidebarContent>
    </>
  )
}
