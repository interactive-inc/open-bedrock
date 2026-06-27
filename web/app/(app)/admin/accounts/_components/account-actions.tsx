"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { revokeAccountRoleAction, setAccountStatusAction } from "@/app/(app)/admin/accounts/actions"
import type { AccountActionFormState } from "@/app/(app)/admin/accounts/actions"
import { Button } from "@/components/ui/button"

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
        className="ml-1 text-muted-foreground hover:text-destructive"
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

  const nextStatus = props.status === "active" ? "suspended" : "active"

  const label = props.status === "active" ? "停止" : "有効化"

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="account_id" value={props.accountId} />

      <input type="hidden" name="status" value={nextStatus} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {label}
      </Button>
    </form>
  )
}
