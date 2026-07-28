"use client"

import { useContext } from "react"
import { AuthContext } from "@/components/auth-context"
import type { MeResponse } from "@/lib/api/types/auth-types"

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
