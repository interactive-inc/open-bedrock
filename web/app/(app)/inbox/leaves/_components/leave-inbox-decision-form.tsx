"use client"

import { useId, useState } from "react"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { decideLeaveRequestAction } from "@/app/(app)/inbox/leaves/actions"
import type { LeaveDecisionState } from "@/app/(app)/inbox/leaves/actions"
import type { LeaveRequestInboxResponse } from "@/lib/api/types/leave-types"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

type Props = { request: LeaveRequestInboxResponse }
const initialState: LeaveDecisionState = { ok: false, error: null }
const unitLabels = {
  full_day: "全日",
  half_day_am: "午前半休",
  half_day_pm: "午後半休",
  hourly: "時間休",
}

/** 開いた時点の内容を保持し、一覧の再取得で確認対象を差し替えない。 */
export function LeaveInboxDecisionForm(props: Props) {
  const [review, setReview] = useState<LeaveRequestInboxResponse | null>(null)
  return (
    <Dialog open={review !== null} onOpenChange={(open) => setReview(open ? props.request : null)}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>内容を確認</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>休暇申請の確認</DialogTitle>
          <DialogDescription>申請内容を確認してから承認・却下してください。</DialogDescription>
        </DialogHeader>
        {review !== null ? (
          <LeaveDecisionForm request={review} onSuccess={() => setReview(null)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** 表示した内容と同じ確認対象を送信する。却下理由は必須。 */
function LeaveDecisionForm(props: Props & { onSuccess: () => void }) {
  const commentId = useId()
  const [state, formAction, isPending] = useFormAction(
    decideLeaveRequestAction,
    initialState,
    (_state, data) =>
      data.get("decision") === "approve" ? "休暇申請を承認しました" : "休暇申請を却下しました",
    { onSuccess: props.onSuccess },
  )
  return (
    <div className="max-h-[65dvh] overflow-y-auto">
      <form action={formAction}>
        <input type="hidden" name="leave_request_id" value={props.request.id} />
        <input
          type="hidden"
          name="decision_target"
          value={JSON.stringify(props.request.decision_target)}
        />
        <FieldGroup>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt>申請番号</dt>
            <dd>{props.request.id}</dd>
            <dt>申請者</dt>
            <dd>
              {props.request.applicant_name}（{props.request.employee_id}）
            </dd>
            <dt>種別</dt>
            <dd>
              <LeaveTypeLabel leaveType={props.request.leave_type} />
            </dd>
            <dt>期間</dt>
            <dd>
              {props.request.start_date} 〜 {props.request.end_date}
            </dd>
            <dt>取得単位</dt>
            <dd>{unitLabels[props.request.unit]}</dd>
            <dt>日数</dt>
            <dd>{props.request.days} 日</dd>
            {props.request.hours !== null ? (
              <>
                <dt>時間数</dt>
                <dd>{props.request.hours} 時間</dd>
              </>
            ) : null}
            <dt>消費日数</dt>
            <dd>{props.request.consumed_days} 日</dd>
            <dt>申請日時</dt>
            <dd>{props.request.created_at}</dd>
            <dt>理由</dt>
            <dd className="whitespace-pre-wrap wrap-anywhere">
              {props.request.reason ?? "記載なし"}
            </dd>
          </dl>
          <Field data-invalid={state.error !== null}>
            <FieldLabel htmlFor={commentId}>コメント（却下時は必須）</FieldLabel>
            <Textarea
              id={commentId}
              name="comment"
              rows={2}
              maxLength={3000}
              aria-invalid={state.error !== null}
              disabled={isPending}
            />
            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
          </Field>
          <Field orientation="horizontal">
            <Button type="submit" name="decision" value="approve" disabled={isPending}>
              承認
            </Button>
            <Button
              type="submit"
              name="decision"
              value="reject"
              variant="destructive"
              disabled={isPending}
            >
              却下
            </Button>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              閉じる
            </DialogClose>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
