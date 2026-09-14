"use client"

import { SettingsDialog } from "@/components/settings-dialog"
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
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { Locale } from "@/lib/i18n/locale"
import { LogOut, Settings } from "lucide-react"
import { useState } from "react"

type Props = {
  currentUser: MeResponse
  locale: Locale
  onLogout: () => void
}

/**
 * 管理画面のセッション確認・表示設定・ログアウト。
 */
export function SidebarUserMenu(props: Props) {
  const initial = props.currentUser.name.slice(0, 1).toUpperCase()

  const [logoutOpen, setLogoutOpen] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="ユーザーメニュー"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Avatar>
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="flex flex-col gap-2">
                <span className="text-sm font-medium">{props.currentUser.name}</span>

                <span className="text-xs text-muted-foreground">{props.currentUser.email}</span>
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

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
            <AlertDialogCancel autoFocus>キャンセル</AlertDialogCancel>

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
