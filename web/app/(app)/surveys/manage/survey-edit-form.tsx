"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateSurveyAction } from "@/app/(app)/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/surveys/manage/actions"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  // 編集対象のアンケート。hidden の id と各入力の初期値に使う。
  id: number
  title: string
  status: "open" | "closed"
  questionsJsonText: string
}

const initialState: SurveyFormState = { ok: false, error: null }

// アンケート編集フォームを Dialog で開く。タイトル・状態・設問 JSON を変更して送信する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function SurveyEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  const action = useActionState(updateSurveyAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。結果をその場で toast し、成功時は Dialog を閉じる。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await updateSurveyAction(state, formData)

    if (result.ok) {
      toast.success("アンケートを更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>アンケートを編集</DialogTitle>

          <DialogDescription>タイトル・状態・設問を変更します。</DialogDescription>
        </DialogHeader>

        <form action={handleAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={props.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-survey-title">タイトル</FieldLabel>

              <Input id="edit-survey-title" name="title" defaultValue={props.title} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-survey-status">状態</FieldLabel>

              <NativeSelect
                id="edit-survey-status"
                name="status"
                defaultValue={props.status}
                className="w-full"
              >
                <NativeSelectOption value="open">実施中</NativeSelectOption>

                <NativeSelectOption value="closed">終了</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-survey-questions">設問（JSON 配列・任意）</FieldLabel>

              <Textarea
                id="edit-survey-questions"
                name="questions_json"
                defaultValue={props.questionsJsonText}
                rows={6}
              />
            </Field>

            {state.error !== null ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中..." : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
