import type { GoalPeriodOption } from "@/app/(app)/performance-review/goals/_lib/to-goal-period-options"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  period: string | null
  employeeId: string | null
  canFilterEmployee: boolean
  periodOptions: GoalPeriodOption[]
}

/**
 * 一覧の絞り込みフォーム。native な GET フォームで /goals?period=&employee_id= へ遷移する。
 * searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
 *
 * 期間は native な select にする。GET フォームがそのまま送信でき、値も評価期間ラベルに固定される。
 */
export function GoalFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-2xl bg-card border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-period">期間</Label>

        <NativeSelect id="filter-period" name="period" defaultValue={props.period ?? ""}>
          <NativeSelectOption value="">すべて</NativeSelectOption>

          {props.periodOptions.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {props.canFilterEmployee ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-employee-id">従業員 ID</Label>

          <Input
            id="filter-employee-id"
            name="employee_id"
            inputMode="numeric"
            placeholder="本人"
            defaultValue={props.employeeId ?? ""}
          />
        </div>
      ) : null}

      <Button type="submit" variant="secondary">
        絞り込む
      </Button>
    </form>
  )
}
