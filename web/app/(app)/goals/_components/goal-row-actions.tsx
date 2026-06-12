"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { deleteGoalAction, updateGoalAction } from "@/app/(app)/goals/actions"
import type { GoalActionState } from "@/app/(app)/goals/actions"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { GoalResponse } from "@/lib/api/types/goal-types"

type Props = {
  goal: GoalResponse
}

// 目標一覧の各行の操作。変更（Dialog フォーム）と削除ボタンを並べる client コンポーネント。
// id が null の目標は操作できないため何も描画しない。
export function GoalRowActions(props: Props) {
  const goalId = props.goal.id

  if (goalId === null) {
    return null
  }

  return (
    <div className="flex justify-end gap-2">
      <UpdateGoalDialog goal={props.goal} goalId={goalId} />

      <DeleteGoalButton goalId={goalId} />
    </div>
  )
}

// 目標変更フォームを Dialog で開く。期間・タイトル・KPI・ウェイトを編集して送信する。
function UpdateGoalDialog(props: { goal: GoalResponse; goalId: number }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: GoalActionState,
    formData: FormData,
  ): Promise<GoalActionState> {
    const result = await updateGoalAction(previousState, formData)

    if (result.ok) {
      toast.success("目標を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>目標を変更</DialogTitle>

          <DialogDescription>期間・タイトル・KPI・ウェイトを変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="goalId" value={props.goalId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_period">期間</FieldLabel>

              <Input id="update_period" name="period" defaultValue={props.goal.period} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_title">タイトル</FieldLabel>

              <Input id="update_title" name="title" defaultValue={props.goal.title} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_kpi">KPI</FieldLabel>

              <Input id="update_kpi" name="kpi" defaultValue={props.goal.kpi ?? ""} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_weight">ウェイト</FieldLabel>

              <Input
                id="update_weight"
                name="weight"
                type="number"
                defaultValue={props.goal.weight}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 目標削除ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。
function DeleteGoalButton(props: { goalId: number }) {
  const [, formAction, pending] = useActionState(deleteGoalAction, {
    ok: false,
    error: null,
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
        削除
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>この目標を削除しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この操作は取り消せません。目標の記録が完全に削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="goalId" value={props.goalId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              削除する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
