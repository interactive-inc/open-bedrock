import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  period: string | null
  employeeId: string | null
  canFilterEmployee: boolean
}

/**
 * 一覧の絞り込みフォーム。native な GET フォームで /goals?period=&employee_id= へ遷移する。
 * searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
 */
export function GoalFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-period">期間</Label>

        <Input
          id="filter-period"
          name="period"
          placeholder="2026-H1"
          defaultValue={props.period ?? ""}
          className="w-40"
        />
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
            className="w-40"
          />
        </div>
      ) : null}

      <Button type="submit" variant="outline">
        絞り込む
      </Button>
    </form>
  )
}
