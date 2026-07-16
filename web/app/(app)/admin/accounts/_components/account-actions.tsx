"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  resetPasswordAction,
  revokeAccountRoleAction,
  setAccountStatusAction,
} from "@/app/(app)/admin/accounts/actions"
import type { AccountActionFormState } from "@/app/(app)/admin/accounts/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"

const initialState: AccountActionFormState = { ok: false, error: null }

type RevokeProps = {
  accountId: number
  roleKey: string
}

// アカウントから特定ロールを剥奪するボタン。
export function RevokeRoleButton(props: RevokeProps) {
  async function reduce(
    previousState: AccountActionFormState,
    formData: FormData,
  ): Promise<AccountActionFormState> {
    const result = await revokeAccountRoleAction(previousState, formData)

    if (result.ok) {
      toast.success("ロールを剥奪しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="account_id" value={props.accountId} />

      <input type="hidden" name="role_key" value={props.roleKey} />

      <button
        type="submit"
        disabled={isPending}
        className="relative ml-1 text-muted-foreground transition-colors select-none hover:text-destructive focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none max-md:after:absolute max-md:after:inset-[-14px] max-md:after:content-['']"
        aria-label={`${props.roleKey} を剥奪`}
      >
        ×
      </button>
    </form>
  )
}

type StatusProps = {
  accountId: number
  status: string
}

// アカウントを停止/有効化するボタン。active なら停止、それ以外は有効化を出す。
export function AccountStatusButton(props: StatusProps) {
  async function reduce(
    previousState: AccountActionFormState,
    formData: FormData,
  ): Promise<AccountActionFormState> {
    const result = await setAccountStatusAction(previousState, formData)

    if (result.ok) {
      toast.success("状態を変更しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  // 有効化(影響が小さい)は即時、停止(ログイン不可になる)は確認ダイアログを挟む。
  if (props.status !== "active") {
    return (
      <form action={formAction} className="inline">
        <input type="hidden" name="account_id" value={props.accountId} />

        <input type="hidden" name="status" value="active" />

        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          有効化
        </Button>
      </form>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
        停止
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>このアカウントを停止しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            停止するとこのアカウントはログインできなくなり、発行済みのトークンも即時無効になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="account_id" value={props.accountId} />

            <input type="hidden" name="status" value="suspended" />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              停止する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type ResetProps = {
  accountId: number
}

// アカウントのパスワードを管理者が再設定するボタン。ダイアログで新パスワードを入力する。
export function ResetPasswordButton(props: ResetProps) {
  async function reduce(
    previousState: AccountActionFormState,
    formData: FormData,
  ): Promise<AccountActionFormState> {
    const result = await resetPasswordAction(previousState, formData)

    if (result.ok) {
      toast.success("パスワードを再設定しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
        PW再設定
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>パスワードを再設定しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            新しいパスワードを設定すると、このアカウントの既存トークンは無効になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="account_id" value={props.accountId} />

          <Field>
            <FieldLabel htmlFor={`new-password-${props.accountId}`}>新しいパスワード</FieldLabel>

            <Input
              id={`new-password-${props.accountId}`}
              type="password"
              name="new_password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
              placeholder="8文字以上で入力…"
            />
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <AlertDialogAction type="submit" disabled={isPending}>
              再設定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
