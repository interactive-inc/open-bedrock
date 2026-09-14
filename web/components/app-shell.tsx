"use client"

import { CommandPalette } from "@/components/command-palette"
import { FeatureDisabledScreen } from "@/components/feature-disabled-screen"
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
import { isPathOfDisabledFeature } from "@/lib/feature/is-path-of-disabled-feature"
import type { Locale } from "@/lib/i18n/locale"
import { usePathname } from "next/navigation"

type Props = {
  children: React.ReactNode
  currentUser: MeResponse
  locale: Locale
  onLogout: () => void
  // 機能ゲートで無効化されている機能キー。ナビから隠し、該当画面は案内に差し替える。
  disabledFeatures: ReadonlyArray<string>
}

/**
 * サイドバー開閉状態を持つアプリ全体シェル。サイドバーは背景色を本文と揃えて境界線を消す。
 */
export function AppShell(props: Props) {
  const pathname = usePathname()

  // 表示の出し分けのみ。強制は api 側の feature gate（無効ルートは 404）が担う。
  const isFeatureDisabledPath = isPathOfDisabledFeature(pathname, props.disabledFeatures)

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-md bg-background px-4 py-2 text-sm shadow focus:not-sr-only"
      >
        本文へスキップ
      </a>

      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex flex-col gap-2 rounded-md px-2 py-2 hover:bg-sidebar-accent">
            <span className="text-base font-semibold tracking-wider">
              {process.env.NEXT_PUBLIC_APP_NAME ?? "BEDROCK"}
            </span>

            <span className="text-xs text-muted-foreground">管理</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav
            permissions={props.currentUser.permissions}
            disabledFeatures={props.disabledFeatures}
          />
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2">
            {/* 設定の入口は隣のユーザーメニューに寄せたので、氏名はリンクにしない。 */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 px-2 py-2">
              <span className="truncate text-sm font-medium">管理セッション</span>

              <span className="truncate text-xs text-muted-foreground">
                {props.currentUser.role_keys.join(", ") || props.currentUser.role}
              </span>
            </div>

            <SidebarUserMenu
              currentUser={props.currentUser}
              locale={props.locale}
              onLogout={props.onLogout}
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main id="main-content" className="flex flex-1 flex-col gap-4 p-4 md:p-8" tabIndex={-1}>
          {isFeatureDisabledPath ? <FeatureDisabledScreen /> : props.children}
        </main>
      </SidebarInset>

      <CommandPalette
        disabledFeatures={props.disabledFeatures}
        permissions={props.currentUser.permissions}
      />
    </SidebarProvider>
  )
}
