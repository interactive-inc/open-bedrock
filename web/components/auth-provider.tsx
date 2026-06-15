"use client"

import { createContext, useContext } from "react"
import type { MeResponse } from "@/lib/api/types/auth-types"

const AuthContext = createContext<MeResponse | null>(null)

type Props = {
  currentUser: MeResponse
  children: React.ReactNode
}

/**
 * 認証済みユーザーをツリー下のコンポーネントへ Context 経由で配る Provider。
 * RSC で取得した `MeResponse` を AppShell の手前で注入する。
 */
export function AuthProvider(props: Props) {
  return <AuthContext.Provider value={props.currentUser}>{props.children}</AuthContext.Provider>
}

/**
 * Provider 配下から現在のログインユーザーを取得する hook。
 * Provider の外から呼ばれた場合は throw する（実装ミス検出のため）。
 */
export function useAuth(): MeResponse {
  const value = useContext(AuthContext)

  if (value === null) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return value
}
