"use client"

import Link from "next/link"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarUserMenu } from "@/components/sidebar-user-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { Locale } from "@/lib/i18n/locale"

type Props = {
  children: React.ReactNode
  currentUser: MeResponse
  locale: Locale
  onLogout: () => void
  unreadNotificationCount: number
}

/**
 * サイドバー開閉状態を持つアプリ全体シェル。サイドバーは背景色を本文と揃えて境界線を消す。
 */
export function AppShell(props: Props) {
  const deptLabel = props.currentUser.dept_name ?? "所属未設定"

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-md bg-background px-3 py-2 text-sm shadow focus:not-sr-only"
      >
        本文へスキップ
      </a>

      <Sidebar collapsible="offcanvas" className="border-none">
        <SidebarHeader>
          <div className="flex flex-col gap-0.5 px-2 py-1">
            <span className="text-base font-semibold tracking-wider">KARTE</span>

            <span className="text-xs text-muted-foreground">{deptLabel}</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav
            unreadNotificationCount={props.unreadNotificationCount}
            permissions={props.currentUser.permissions}
          />
        </SidebarContent>

        <SidebarFooter className="border-t border-border/70 bg-muted/60">
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1 hover:bg-sidebar-accent"
            >
              <span className="truncate text-sm font-medium">{props.currentUser.name}</span>

              <span className="truncate text-xs text-muted-foreground">
                {props.currentUser.role_keys.join(", ") || props.currentUser.role}
              </span>
            </Link>

            <SidebarUserMenu
              currentUser={props.currentUser}
              locale={props.locale}
              onLogout={props.onLogout}
              unreadNotificationCount={props.unreadNotificationCount}
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main id="main-content" className="flex flex-1 flex-col gap-4 p-4 md:p-6" tabIndex={-1}>
          {props.children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
