"use client"

import { Eye, EyeOff } from "lucide-react"
import { useActionState, useEffect, useState } from "react"
import { loginAction } from "@/lib/auth/login-action"
import { resolveLoginDefaults } from "@/lib/auth/resolve-login-defaults"
import type { LoginState } from "@/lib/auth/login-action"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslator } from "@/lib/i18n/use-translator"

const initialState: LoginState = { ok: false, error: null }

/**
 * メール + パスワードでサインインするフォーム。`useActionState` で `loginAction` を呼び、
 * 成功時は Server Action 内で cookie を立て、現在の error boundary を再描画する。
 * `next dev` のときだけローカル seed の資格情報を初期入力する（resolveLoginDefaults）。
 */
type Props = {
  onAuthenticated: () => void
}

export function LoginForm(props: Props) {
  const t = useTranslator()

  const action = useActionState(loginAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  const [showPassword, setShowPassword] = useState(false)

  const defaults = resolveLoginDefaults(process.env.NODE_ENV)

  useEffect(() => {
    if (state.ok) {
      props.onAuthenticated()
    }
  }, [props.onAuthenticated, state.ok])

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
            defaultValue={defaults?.email}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="login-password">{t("パスワード")}</FieldLabel>

          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              defaultValue={defaults?.password}
              required
              className="pr-10"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t("パスワードを隠す") : t("パスワードを表示")}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
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
