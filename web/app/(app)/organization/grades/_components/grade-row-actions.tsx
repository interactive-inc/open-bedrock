"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteGradeAction } from "@/app/(app)/organization/grades/actions"
import { GradeEditForm } from "@/app/(app)/organization/grades/_components/grade-edit-form"
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
import type { GradeResponse } from "@/lib/api/types/grade-types"

type Props = {
  grade: GradeResponse
}

/** 等級一覧の各行の操作。変更（Dialog フォーム）と削除ボタンを並べる。 */
export function GradeRowActions(props: Props) {
  return (
    <div className="flex justify-end gap-2">
      <GradeEditForm grade={props.grade} />

      <DeleteGradeButton gradeId={props.grade.id} />
    </div>
  )
}

/** 等級削除ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。 */
function DeleteGradeButton(props: { gradeId: number }) {
  async function reduce(previousState: { ok: boolean; error: string | null }, formData: FormData) {
    const result = await deleteGradeAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    } else if (result.ok) {
      toast.success("等級を削除しました")
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
          <AlertDialogTitle>この等級を削除しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この操作は取り消せません。等級マスタの記録が完全に削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="gradeId" value={props.gradeId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              削除する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
