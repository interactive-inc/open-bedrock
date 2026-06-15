"use client"

import { LogOut } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { SidebarNav } from "@/components/sidebar-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { Theme } from "@/lib/theme/get-theme"

type Props = {
  children: React.ReactNode
  currentUser: MeResponse
  onLogout: () => void
  unreadNotificationCount: number
  theme: Theme
}

/**
 * サイドバー開閉状態を持つアプリ全体シェル。サイドバーは背景色を本文と揃えて境界線を消す。
 */
export function AppShell(props: Props) {
  const deptLabel = props.currentUser.dept_name ?? "所属未設定"

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-none">
        <SidebarHeader>
          <div className="flex flex-col gap-0.5 px-2 py-1">
            <span className="text-base font-semibold tracking-wider">KARTE</span>

            <span className="text-xs text-muted-foreground">{deptLabel}</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav unreadNotificationCount={props.unreadNotificationCount} />
        </SidebarContent>

        <SidebarFooter>
          <div className="flex flex-col gap-0.5 px-2 py-1">
            <span className="text-sm font-medium">{props.currentUser.name}</span>

            <span className="text-xs text-muted-foreground">{props.currentUser.role}</span>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <form action={props.onLogout}>
                <SidebarMenuButton render={<button type="submit" />}>
                  <LogOut />

                  <span>ログアウト</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <AppHeader
          currentUser={props.currentUser}
          onLogout={props.onLogout}
          unreadNotificationCount={props.unreadNotificationCount}
          theme={props.theme}
        />

        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{props.children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
