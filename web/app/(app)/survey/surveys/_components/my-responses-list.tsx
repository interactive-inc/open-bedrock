"use client"

import { formatDateTime } from "@/lib/format-date-time"
import { useState } from "react"
import {
  updateSurveyResponseAction,
  withdrawSurveyResponseAction,
} from "@/app/(app)/survey/surveys/actions"
import type { MyResponseActionState } from "@/app/(app)/survey/surveys/actions"
import { useFormAction } from "@/hooks/use-form-action"
import type { SurveyResponseItem } from "@/lib/api/types/survey-types"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  responses: ReadonlyArray<SurveyResponseItem>
  surveyTitleMap: Record<number, string>
}

/** 回答内容を「設問 id: 値」のペア配列に正規化する。answers_json は unknown のため安全に絞り込む。 */
type AnswerEntry = {
  questionId: string
  value: string
}

/** 自分のアンケート回答一覧。各行に変更（Dialog フォーム）と取り下げボタンを置く表示コンポーネント。 */
export function MyResponsesList(props: Props) {
  if (props.responses.length === 0) {
    return <EmptyState title="提出済みの回答はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>アンケート</TableHead>
            <TableHead>提出日時</TableHead>
            <TableHead className="w-48 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.responses.map((response) => {
            // id は永続化前のみ null。一覧に並ぶのは採番済みのため、null 行は描画しない。
            if (response.id === null) {
              return null
            }

            const responseId = response.id

            return (
              <TableRow key={responseId}>
                <TableCell className="font-medium">
                  {props.surveyTitleMap[response.survey_id] ?? `#${response.survey_id}`}
                </TableCell>

                <TableCell>{formatDateTime(response.submitted_at)}</TableCell>

                <TableCell>
                  <TableRowActions>
                    <UpdateResponseDialog responseId={responseId} response={response} />

                    <WithdrawResponseButton responseId={responseId} />
                  </TableRowActions>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** 回答変更フォームを Dialog で開く。既存回答を設問ごとの入力に展開して送信する。 */
function UpdateResponseDialog(props: { responseId: number; response: SurveyResponseItem }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateSurveyResponseAction,
    { ok: false, error: null } satisfies MyResponseActionState,
    "回答を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  const entries = toAnswerEntries(props.response.answers_json)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>回答を変更</DialogTitle>

          <DialogDescription>設問ごとの回答を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="responseId" value={props.responseId} />

          <FieldGroup>
            {entries.map((entry) => (
              <Field key={entry.questionId}>
                <FieldLabel htmlFor={`answer:${entry.questionId}`}>{entry.questionId}</FieldLabel>

                <Input
                  id={`answer:${entry.questionId}`}
                  name={`answer:${entry.questionId}`}
                  defaultValue={entry.value}
                  maxLength={FORM_CONSTRAINTS.survey.answersJsonMax}
                />
              </Field>
            ))}
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 回答取り下げボタン。Server Action を呼び、成功時はリストが revalidate される。 */
function WithdrawResponseButton(props: { responseId: number }) {
  const [_state, formAction, pending] = useFormAction(
    withdrawSurveyResponseAction,
    {
      ok: false,
      error: null,
    },
    "回答を取り下げました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="このアンケート回答を取り下げますか？"
      description="取り下げた回答は集計から除外され、元に戻せません。"
      confirmLabel="回答を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="responseId" value={props.responseId} />
    </ConfirmActionDialog>
  )
}

/** answers_json (unknown) を設問 id/文字列値のペアに正規化する。非オブジェクトは空配列。 */
function toAnswerEntries(answersJson: unknown): ReadonlyArray<AnswerEntry> {
  if (answersJson === null || typeof answersJson !== "object") {
    return []
  }

  const entries: Array<AnswerEntry> = []

  for (const entry of Object.entries(answersJson)) {
    entries.push({ questionId: entry[0], value: String(entry[1]) })
  }

  return entries
}
