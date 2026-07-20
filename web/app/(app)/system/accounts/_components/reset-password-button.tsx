"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { resetPasswordAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionFormState } from "@/app/(app)/system/accounts/actions"
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

type Props = {
  accountId: number
}

/** アカウントのパスワードを管理者が再設定するボタン。ダイアログで新パスワードを入力する。 */
export function ResetPasswordButton(props: Props) {
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
