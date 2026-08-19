"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { grantAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { GrantRoleFormState } from "@/app/(app)/system/accounts/actions"
import { Button } from "@/components/ui/button"

type Props = {
  accountId: string
  roles: ReadonlyArray<{ id: string; key: string }>
}

const initialState: GrantRoleFormState = { ok: false, error: null }

const selectClassName =
  "h-8 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

/** アカウント行のインライン: ロールを選んで付与する。割当可能なロール一覧から選択する。 */
export function GrantRoleForm(props: Props) {
  async function reduce(
    previousState: GrantRoleFormState,
    formData: FormData,
  ): Promise<GrantRoleFormState> {
    const result = await grantAccountRoleAction(previousState, formData)

    if (result.ok) {
      toast.success("ロールを付与しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="account_id" value={props.accountId} />

      <select
        name="role_id"
        className={selectClassName}
        defaultValue=""
        aria-label="付与するロール"
      >
        <option value="" disabled>
          ロールを選択
        </option>

        {props.roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.key}
          </option>
        ))}
      </select>

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        付与
      </Button>
    </form>
  )
}
