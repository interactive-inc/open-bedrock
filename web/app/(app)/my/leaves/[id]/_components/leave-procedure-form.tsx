"use client"

import { useActionState } from "react"
import { actOnLeaveProcedure } from "@/app/(app)/my/leaves/[id]/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"

type Props = {
  id: number
  previousId: number | null
  operation: "submit" | "decision" | "complete" | "cancel"
  requestKey: string
  contentDigest: string
  target: {
    proposal_version: number
    proposal_digest: string
    task_key: string
    task_round: number
  } | null
}

/** 確認済みの内容を保持したまま提出・判断・確定を送信する。 */
export function LeaveProcedureForm(props: Props) {
  const state = useActionState(actOnLeaveProcedure, { ok: false, error: null })
  return (
    <form action={state[1]}>
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="previous_leave_request_id" value={props.previousId ?? ""} />
      <input type="hidden" name="request_key" value={props.requestKey} />
      <input type="hidden" name="confirmed_content_digest" value={props.contentDigest} />
      <input type="hidden" name="decision_target" value={JSON.stringify(props.target)} />
      <FieldGroup>
        {props.operation === "decision" ? (
          <Field>
            <FieldLabel htmlFor="leave-decision-comment">判断のコメント</FieldLabel>
            <Textarea
              id="leave-decision-comment"
              name="comment"
              maxLength={3000}
              disabled={state[2] || state[0].ok}
            />
          </Field>
        ) : null}
        <Field orientation="horizontal">
          {props.operation === "decision" ? (
            <>
              <Button
                type="submit"
                name="operation"
                value="approve"
                disabled={state[2] || state[0].ok}
              >
                この内容を承認
              </Button>
              <Button
                type="submit"
                name="operation"
                value="reject"
                variant="secondary"
                disabled={state[2] || state[0].ok}
              >
                却下・差戻し
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              name="operation"
              value={props.operation}
              disabled={state[2] || state[0].ok}
            >
              {props.operation === "submit"
                ? "この内容で承認規程へ提出"
                : props.operation === "cancel"
                  ? "この申請を取り消す"
                  : "確定を再試行"}
            </Button>
          )}
        </Field>
        {state[0].ok ? <p role="status">処理しました。</p> : null}
        {state[0].error !== null ? <FieldError role="alert">{state[0].error}</FieldError> : null}
      </FieldGroup>
    </form>
  )
}
