import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  year: string | null
}

/** 会社カレンダーの年絞り込みフォーム。native な GET フォームで ?year= へ遷移する。 */
export function CalendarYearForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="calendar-year">年</Label>

        <Input
          id="calendar-year"
          name="year"
          inputMode="numeric"
          placeholder="例: 2026"
          defaultValue={props.year ?? ""}
          className="w-32"
        />
      </div>

      <Button type="submit" variant="outline">
        表示
      </Button>
    </form>
  )
}
