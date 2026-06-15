"use client"

import { Bell, LogOut, User } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { Theme } from "@/lib/theme/get-theme"
import { ThemeToggle } from "@/components/theme-toggle"

type Props = {
  currentUser: MeResponse
  onLogout: () => void
  unreadNotificationCount: number
  theme: Theme
}

/**
 * 上部ヘッダ。サイドバーのトリガ、通知ベル、テーマ切替、ユーザーメニューを置く。
 * 「open-karte」のテキストは廃止し、ブランドは左側サイドバーに集約する。
 */
export function AppHeader(props: Props) {
  const initial = props.currentUser.name.slice(0, 1).toUpperCase()

  return (
    <header className="flex h-14 items-center gap-2 px-4">
      <SidebarTrigger />

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          className="relative"
          aria-label={
            props.unreadNotificationCount > 0
              ? `通知（未読 ${props.unreadNotificationCount} 件）`
              : "通知"
          }
          render={<Link href="/notifications" />}
        >
          <Bell />

          {props.unreadNotificationCount > 0 ? (
            <Badge className="absolute -top-1 -right-1 size-4 justify-center rounded-full p-0 text-[10px]">
              {props.unreadNotificationCount}
            </Badge>
          ) : null}
        </Button>

        <ThemeToggle theme={props.theme} />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="ユーザーメニュー"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{props.currentUser.name}</span>

                  <span className="text-xs text-muted-foreground">{props.currentUser.email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem render={<a href="/employees" />}>
              <User />
              <span>プロフィール</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              closeOnClick={false}
              render={
                <form action={props.onLogout}>
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut />
                    <span>ログアウト</span>
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
