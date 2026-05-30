"use client"

import { LogOut, User } from "lucide-react"
import type { MeResponse } from "@/lib/api/types/auth-types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

type Props = {
  currentUser: MeResponse
  onLogout: () => void
}

// SidebarTrigger + ユーザーアバターのドロップダウン (Profile / Logout) を持つヘッダ。
// ログアウトは Server Action を form 経由で呼ぶため、その action 関数を props で受け取る。
export function AppHeader(props: Props) {
  const initial = props.currentUser.name.slice(0, 1).toUpperCase()

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger />

      <span className="text-sm font-medium">open-karte</span>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="ユーザーメニュー" />}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{props.currentUser.name}</span>

                <span className="text-xs text-muted-foreground">{props.currentUser.email}</span>
              </span>
            </DropdownMenuLabel>

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
