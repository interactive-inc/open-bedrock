"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/my/reviews/actions"
import { createReviewCycleAction } from "@/app/(app)/my/reviews/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldContent, FieldDescription } from "@/components/ui/field"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: ReviewFormState = { ok: false, error: null }

/**
 * 評価サイクルの作成フォーム（特権ロール向け）。タイトル・対象期間・締切日を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function ReviewCycleCreateForm() {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await createReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("評価サイクルを作成しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="review-cycle-title">タイトル</FieldLabel>

          <Input
            id="review-cycle-title"
            name="title"
            placeholder="2026 上期評価"
            maxLength={FORM_CONSTRAINTS.review.titleMax}
            required
          />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">評価者の自動割当</legend>

          <PolicySwitch
            name="include_self"
            label="自己評価"
            description="対象者本人のフォームを作成します。"
            defaultChecked
          />
          <PolicySwitch
            name="include_manager"
            label="上司評価"
            description="組織図の直属上司を割り当てます。"
            defaultChecked
          />
          <PolicySwitch
            name="include_peers"
            label="同僚評価"
            description="同じ部門の従業員を割り当てます。"
          />
          <PolicySwitch
            name="include_subordinates"
            label="部下評価"
            description="直属部下を評価者として割り当てます。"
          />

          <Field>
            <FieldLabel htmlFor="review-peer-count">同僚評価者数</FieldLabel>
            <Input
              id="review-peer-count"
              name="peer_count"
              type="number"
              min={0}
              max={20}
              defaultValue={0}
            />
            <FieldDescription>0 は同じ部門の全員です。</FieldDescription>
          </Field>
        </fieldset>

        <Field>
          <FieldLabel htmlFor="review-cycle-period">対象期間</FieldLabel>

          <Input
            id="review-cycle-period"
            name="period"
            placeholder="2026-H1"
            maxLength={FORM_CONSTRAINTS.review.periodMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="review-cycle-due-date">締切日</FieldLabel>

          <Input id="review-cycle-due-date" name="due_date" type="date" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "評価サイクルを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

function PolicySwitch(props: {
  name: string
  label: string
  description: string
  defaultChecked?: boolean
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={`review-${props.name}`}>{props.label}</FieldLabel>
        <FieldDescription>{props.description}</FieldDescription>
      </FieldContent>
      <Switch id={`review-${props.name}`} name={props.name} defaultChecked={props.defaultChecked} />
    </Field>
  )
}
