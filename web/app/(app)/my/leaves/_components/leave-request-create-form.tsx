"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { createLeaveRequestAction } from "@/app/(app)/my/leaves/actions"
import type { LeaveActionState } from "@/app/(app)/my/leaves/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"

const initialState: LeaveActionState = { ok: false, error: null }

/**
 * 休暇申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 * 成功時は自分の休暇一覧へ遷移し、残日数と申請ステータスを見せる。
 */
export function LeaveRequestCreateForm() {
  const router = useRouter()

  const [leaveType, setLeaveType] = useState("annual")

  const [unit, setUnit] = useState("full_day")

  const [singleDate, setSingleDate] = useState("")

  const isSingleDateUnit =
    leaveType === "annual" &&
    (unit === "half_day_am" || unit === "half_day_pm" || unit === "hourly")

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: LeaveActionState,
    formData: FormData,
  ): Promise<LeaveActionState> {
    const result = await createLeaveRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("休暇申請を提出しました")

      router.push("/my/leaves")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h3 className="text-lg font-medium">休暇を申請</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leave-type">休暇種別</FieldLabel>

          <NativeSelect
            id="leave-type"
            name="leave_type"
            defaultValue="annual"
            className="w-full"
            onChange={(event) => setLeaveType(event.target.value)}
          >
            <NativeSelectOption value="annual">年次有給</NativeSelectOption>

            <NativeSelectOption value="special">特別休暇</NativeSelectOption>

            <NativeSelectOption value="compensatory">代休</NativeSelectOption>

            <NativeSelectOption value="summer">夏季休暇</NativeSelectOption>

            <NativeSelectOption value="child_nursing_care">子の看護等休暇</NativeSelectOption>

            <NativeSelectOption value="prenatal_checkup">妊婦通院休暇</NativeSelectOption>

            <NativeSelectOption value="menstrual">生理休暇</NativeSelectOption>

            <NativeSelectOption value="caregiving_leave">介護休暇</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="leave-reason">理由</FieldLabel>

          <Input id="leave-reason" name="reason" placeholder="任意" />
        </Field>

        {isSingleDateUnit ? (
          <Field>
            <FieldLabel htmlFor="leave-date">対象日</FieldLabel>

            <Input
              id="leave-date"
              name="start_date"
              type="date"
              required
              value={singleDate}
              onChange={(event) => setSingleDate(event.target.value)}
            />

            <input type="hidden" name="end_date" value={singleDate} />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="leave-start">開始日</FieldLabel>

              <Input id="leave-start" name="start_date" type="date" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="leave-end">終了日</FieldLabel>

              <Input id="leave-end" name="end_date" type="date" required />
            </Field>
          </>
        )}

        {leaveType === "annual" ? (
          <Field>
            <FieldLabel htmlFor="leave-unit">取得単位</FieldLabel>

            <NativeSelect
              id="leave-unit"
              name="unit"
              defaultValue="full_day"
              className="w-full"
              onChange={(event) => setUnit(event.target.value)}
            >
              <NativeSelectOption value="full_day">全休</NativeSelectOption>

              <NativeSelectOption value="half_day_am">午前半休</NativeSelectOption>

              <NativeSelectOption value="half_day_pm">午後半休</NativeSelectOption>

              <NativeSelectOption value="hourly">時間休</NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : (
          <input type="hidden" name="unit" value="full_day" />
        )}

        {leaveType === "annual" && unit === "hourly" ? (
          <Field>
            <FieldLabel htmlFor="leave-hours">時間数</FieldLabel>

            <Input id="leave-hours" name="hours" type="number" min="1" step="1" required />
          </Field>
        ) : null}
      </div>

      <FieldDescription>
        開始日と終了日から日数が自動計算され、承認後に残日数へ反映されます
      </FieldDescription>

      <FieldDescription>
        夏季休暇・子の看護等休暇・介護休暇には勤続期間や所定労働日数などの資格要件があります。要件を満たすかは承認者が確認します
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="mr-2" /> : null}
          {isPending ? "提出中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
