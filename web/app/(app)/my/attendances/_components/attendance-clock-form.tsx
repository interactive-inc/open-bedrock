"use client"

import { CheckCircle, Loader2 } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"
import { clockInAction, clockOutAction } from "@/app/(app)/my/attendances/actions"
import type { AttendanceActionState } from "@/app/(app)/my/attendances/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  // 打刻種別。clock-in=出勤 / clock-out=退勤。
  mode: "clock-in" | "clock-out"
}

const initialState: AttendanceActionState = { ok: false, error: null, clockedAt: null }

/**
 * 打刻フォーム。mode に応じて出勤 / 退勤の Server Action を useActionState 経由で呼ぶ。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 * 打刻成功時はフォーム内にチェックマークと時刻を表示して視覚フィードバックを強化する。
 */
export function AttendanceClockForm(props: Props) {
  const isClockIn = props.mode === "clock-in"

  const label = isClockIn ? "出勤" : "退勤"

  /** useActionState の reducer。mode に応じた Server Action を実行し結果を次の state にする。 */
  async function reduce(
    previousState: AttendanceActionState,
    formData: FormData,
  ): Promise<AttendanceActionState> {
    const result = isClockIn
      ? await clockInAction(previousState, formData)
      : await clockOutAction(previousState, formData)

    if (result.ok) {
      toast.success(`${label}を打刻しました`)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  // 打刻成功時だけ緑を敷く。それ以外はコンテンツ背景に沈まないよう白を敷く。
  const borderClass = state.ok
    ? "border-green-500/50 bg-green-50/50 dark:border-green-500/30 dark:bg-green-950/20"
    : "bg-card"

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors duration-300 ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{label}打刻</h2>

        {state.ok && state.clockedAt !== null ? (
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle className="size-4" />
            <span>{state.clockedAt} 打刻済み</span>
          </div>
        ) : null}
      </div>

      <Field>
        <FieldLabel htmlFor={`${props.mode}-note`}>メモ</FieldLabel>

        <Input id={`${props.mode}-note`} name="note" placeholder="任意" />
      </Field>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <Field orientation="horizontal">
        {/* 出勤・退勤とも主要操作なので既定の黒。打刻済みだけ secondary に落とす。 */}
        <Button type="submit" variant={state.ok ? "secondary" : "default"} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {label}打刻中...
            </>
          ) : state.ok ? (
            <>
              <CheckCircle className="size-4" />
              {label}済み
            </>
          ) : (
            `${label}を打刻`
          )}
        </Button>
      </Field>
    </form>
  )
}
