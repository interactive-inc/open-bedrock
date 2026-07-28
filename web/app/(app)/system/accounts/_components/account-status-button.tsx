"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { setAccountStatusAction } from "@/app/(app)/system/accounts/actions"
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

const initialState: AccountActionFormState = { ok: false, error: null }

type Props = {
  accountId: number
  status: string
}

/** アカウントを停止/有効化するボタン。active なら停止、それ以外は有効化を出す。 */
export function AccountStatusButton(props: Props) {
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
