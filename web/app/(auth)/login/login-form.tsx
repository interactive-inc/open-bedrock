"use client"

import { useActionState } from "react"
import { loginAction } from "@/app/(auth)/login/actions"
import type { LoginState } from "@/app/(auth)/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: LoginState = { ok: false, error: null }

// ログインフォーム。useActionState で loginAction を呼び、エラーは state.error に出す。
export function LoginForm() {
  const action = useActionState(loginAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>

        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">パスワード</Label>

        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "サインイン中..." : "サインイン"}
      </Button>
    </form>
  )
}
