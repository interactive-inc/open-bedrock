"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { revokeAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionFormState } from "@/app/(app)/system/accounts/actions"

const initialState: AccountActionFormState = { ok: false, error: null }

type Props = {
  accountId: number
  roleKey: string
}

/** アカウントから特定ロールを剥奪するボタン。 */
export function RevokeRoleButton(props: Props) {
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
