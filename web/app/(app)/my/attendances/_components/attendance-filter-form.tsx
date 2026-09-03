import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  // 管理者一覧で employee_id 絞り込みを出すかどうか。本人画面では false。
  withEmployeeId: boolean
  employeeId: string | null
  from: string | null
  to: string | null
}

/**
 * 勤怠の絞り込みフォーム。native な GET フォームで ?from=&to=&employee_id= へ遷移する。
 * searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
 */
export function AttendanceFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl bg-card border p-4">
      {props.withEmployeeId ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-employee-id">従業員 ID</Label>

          <Input
            id="filter-employee-id"
            name="employee_id"
            inputMode="numeric"
            placeholder="全員"
            defaultValue={props.employeeId ?? ""}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-from">開始日</Label>

        <Input id="filter-from" name="from" type="date" defaultValue={props.from ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-to">終了日</Label>

        <Input id="filter-to" name="to" type="date" defaultValue={props.to ?? ""} />
      </div>

      <Button type="submit" variant="secondary">
        絞り込む
      </Button>
    </form>
  )
}
