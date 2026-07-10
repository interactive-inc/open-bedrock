"use client"

import { useActionState } from "react"
import { loginAction } from "@/lib/auth/login-action"
import type { LoginState } from "@/lib/auth/login-action"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslator } from "@/lib/i18n/use-translator"

const initialState: LoginState = { ok: false, error: null }

/**
 * メール + パスワードでサインインするフォーム。`useActionState` で `loginAction` を呼び、
 * 成功時は Server Action 内で cookie を立てて `/` に redirect する。
 */
export function LoginForm() {
  const t = useTranslator()

  const action = useActionState(loginAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">{t("メールアドレス")}</FieldLabel>

          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="login-password">{t("パスワード")}</FieldLabel>

          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("サインイン中...") : t("サインイン")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
