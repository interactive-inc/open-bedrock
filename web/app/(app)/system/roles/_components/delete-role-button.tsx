"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteRoleAction } from "@/app/(app)/system/roles/actions"
import type { RoleDeleteFormState } from "@/app/(app)/system/roles/actions"
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

type Props = {
  roleId: number
  roleName: string
}

const initialState: RoleDeleteFormState = { ok: false, error: null }

// 動的ロールを削除するボタン。削除前に確認ダイアログを挟む。system role には表示しない。
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
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
        削除
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ロール「{props.roleName}」を削除しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この操作は取り消せません。割当中のロールは削除できません。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="role_id" value={props.roleId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              削除する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
