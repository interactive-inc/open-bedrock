"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { createStructuralGoalAction } from "@/app/(app)/performance-review/goals/actions"
import type { GoalActionState } from "@/app/(app)/performance-review/goals/actions"
import type { GoalPeriodOption } from "@/app/(app)/performance-review/goals/_lib/to-goal-period-options"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  canCreateCompany: boolean
  canCreateDepartment: boolean
  defaultPeriod: string | null
  periodOptions: GoalPeriodOption[]
}

const initialState: GoalActionState = { ok: false, error: null }

/**
 * 全社/部門目標の作成フォーム。権限に応じて選べる種別を出し分ける。
 * department を選んだときだけ部門コード欄を出す（useState は許可、useEffect は使わない）。
 */
export function StructuralGoalCreateForm(props: Props) {
  const router = useRouter()

  const defaultOwnerType = props.canCreateCompany ? "company" : "department"

  const ownerTypeState = useState<"company" | "department">(defaultOwnerType)

  const ownerType = ownerTypeState[0]

  const setOwnerType = ownerTypeState[1]

  async function reduce(
    previousState: GoalActionState,
    formData: FormData,
  ): Promise<GoalActionState> {
    const result = await createStructuralGoalAction(previousState, formData)

    if (result.ok) {
      toast.success("目標を作成しました")

      router.refresh()
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-card border p-4">
      <h2 className="text-lg font-medium">全社・部門目標を作成</h2>

      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="structural-owner-type">種別</FieldLabel>

            <NativeSelect
              id="structural-owner-type"
              name="ownerType"
              value={ownerType}
              onChange={(event) =>
                setOwnerType(event.target.value === "company" ? "company" : "department")
              }
            >
              {props.canCreateCompany ? (
                <NativeSelectOption value="company">全社</NativeSelectOption>
              ) : null}

              {props.canCreateDepartment ? (
                <NativeSelectOption value="department">部門</NativeSelectOption>
              ) : null}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="structural-period">期間</FieldLabel>

            <Select name="period" defaultValue={props.defaultPeriod ?? undefined} required>
              <SelectTrigger id="structural-period" className="w-full">
                <SelectValue placeholder="期間を選択" />
              </SelectTrigger>

              <SelectContent>
                {props.periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="structural-title">タイトル</FieldLabel>

            <Input
              id="structural-title"
              name="title"
              maxLength={FORM_CONSTRAINTS.goal.titleMax}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="structural-weight">ウェイト</FieldLabel>

            <Input
              id="structural-weight"
              name="weight"
              type="number"
              inputMode="numeric"
              min={FORM_CONSTRAINTS.goal.weightMin}
              max={FORM_CONSTRAINTS.goal.weightMax}
              step={1}
              defaultValue="10"
            />
          </Field>

          {ownerType === "department" ? (
            <Field>
              <FieldLabel htmlFor="structural-department-code">部門コード</FieldLabel>

              <Input
                id="structural-department-code"
                name="departmentCode"
                placeholder="D003"
                maxLength={100}
                required
              />
            </Field>
          ) : null}
        </div>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "作成する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
