"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { grantAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { GrantRoleFormState } from "@/app/(app)/system/accounts/actions"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  accountId: string
  roles: ReadonlyArray<{ id: string; key: string }>
}

const initialState: GrantRoleFormState = { ok: false, error: null }

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

      <NativeSelect name="role_id" defaultValue="" aria-label="付与するロール">
        <NativeSelectOption value="" disabled>
          ロールを選択
        </NativeSelectOption>

        {props.roles.map((role) => (
          <NativeSelectOption key={role.id} value={role.id}>
            {role.key}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        付与
      </Button>
    </form>
  )
}
