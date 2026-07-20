"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { updateSkillAction } from "@/app/(app)/my/skills/actions"
import type { SkillUpdateState } from "@/app/(app)/my/skills/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: SkillUpdateState = { ok: false, error: null }

const levelOptions = Array.from(
  { length: FORM_CONSTRAINTS.skill.levelMax - FORM_CONSTRAINTS.skill.levelMin + 1 },
  (_, index) => FORM_CONSTRAINTS.skill.levelMin + index,
)

/**
 * 本人のスキル登録/更新フォーム。useActionState で updateSkillAction を呼ぶ。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function SkillUpdateForm() {
  async function reduce(
    previousState: SkillUpdateState,
    formData: FormData,
  ): Promise<SkillUpdateState> {
    const result = await updateSkillAction(previousState, formData)

    if (result.ok) {
      toast.success("スキルを保存しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="skill_code">スキルコード</FieldLabel>

          <Input
            id="skill_code"
            name="skill_code"
            required
            maxLength={FORM_CONSTRAINTS.skill.codeMax}
            placeholder="例: TYPESCRIPT"
          />

          <FieldDescription>
            スキル一覧のコードを指定します。同じコードは上書きされます。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="level">レベル</FieldLabel>

          <select
            id="level"
            name="level"
            required
            defaultValue=""
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="" disabled>
              選択してください
            </option>

            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>

          <FieldDescription>1〜10 の習熟度を選びます。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="years">経験年数（任意）</FieldLabel>

          <Input
            id="years"
            name="years"
            type="number"
            min={FORM_CONSTRAINTS.skill.yearsMin}
            step={1}
            placeholder="例: 3"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="note">メモ（任意）</FieldLabel>

          <Textarea
            id="note"
            name="note"
            rows={3}
            maxLength={FORM_CONSTRAINTS.skill.noteMax}
            placeholder="補足や具体的な経験など"
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "保存する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
