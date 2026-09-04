"use client"

import { X } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"
import { revokeAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionFormState } from "@/app/(app)/system/accounts/actions"
import { Button } from "@/components/ui/button"

const initialState: AccountActionFormState = { ok: false, error: null }

type Props = {
  accountId: string
  bindingId: string
  roleLabel: string
}

/** ロール名を表示し、押すとそのロールをアカウントから剥奪するボタン。 */
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
    <form action={formAction}>
      <input type="hidden" name="account_id" value={props.accountId} />

      <input type="hidden" name="binding_id" value={props.bindingId} />

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={isPending}
        aria-label={`${props.roleLabel} を剥奪`}
      >
        {props.roleLabel}
        <X data-icon="inline-end" />
      </Button>
    </form>
  )
}
