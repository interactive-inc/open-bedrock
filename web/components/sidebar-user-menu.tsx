"use client"

import { Bell, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { SettingsDialog } from "@/components/settings-dialog"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { Locale } from "@/lib/i18n/locale"

type Props = {
  currentUser: MeResponse
  locale: Locale
  onLogout: () => void
  unreadNotificationCount: number
}

/**
 * サイドバー下部に置く通知ベルとユーザーメニュー。
 */
export function SidebarUserMenu(props: Props) {
  const initial = props.currentUser.name.slice(0, 1).toUpperCase()

  const [logoutOpen, setLogoutOpen] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex items-center gap-1">
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

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="ユーザーメニュー"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Avatar className="size-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top" className="w-56">
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

          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <Settings />
            <span>設定</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onClick={() => setLogoutOpen(true)}>
            <LogOut />
            <span>ログアウト</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog locale={props.locale} open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトしますか?</AlertDialogTitle>

            <AlertDialogDescription>
              もう一度ログインするにはパスワードが必要です。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>

            <form action={props.onLogout}>
              <AlertDialogAction type="submit" variant="destructive">
                ログアウト
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
