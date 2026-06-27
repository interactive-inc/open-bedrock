"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteRoleAction } from "@/app/(app)/admin/roles/actions"
import type { RoleDeleteFormState } from "@/app/(app)/admin/roles/actions"
import { Button } from "@/components/ui/button"

type Props = {
  roleId: number
}

const initialState: RoleDeleteFormState = { ok: false, error: null }

// 動的ロールを削除するボタン。system role には表示しない。
export function DeleteRoleButton(props: Props) {
  async function reduce(
    previousState: RoleDeleteFormState,
    formData: FormData,
  ): Promise<RoleDeleteFormState> {
    const result = await deleteRoleAction(previousState, formData)

    if (result.ok) {
      toast.success("ロールを削除しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="role_id" value={props.roleId} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
