"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deletePositionAction } from "@/app/(app)/positions/actions"
import { PositionEditForm } from "@/app/(app)/positions/_components/position-edit-form"
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
import type { PositionResponse } from "@/lib/api/types/position-types"

type Props = {
  position: PositionResponse
}

// 役職一覧の各行の操作。変更（Dialog フォーム）と削除ボタンを並べる。
export function PositionRowActions(props: Props) {
  return (
    <div className="flex justify-end gap-2">
      <PositionEditForm position={props.position} />

      <DeletePositionButton positionId={props.position.id} />
    </div>
  )
}

// 役職削除ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。
function DeletePositionButton(props: { positionId: number }) {
  async function reduce(previousState: { ok: boolean; error: string | null }, formData: FormData) {
    const result = await deletePositionAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    } else if (result.ok) {
      toast.success("役職を削除しました")
    }

    return result
  }

  const action = useActionState(reduce, { ok: false, error: null })

  const formAction = action[1]

  const isPending = action[2]

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={isPending} />}>
        削除
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>この役職を削除しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この操作は取り消せません。役職マスタの記録が完全に削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="positionId" value={props.positionId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              削除する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
