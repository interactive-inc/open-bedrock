import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  month: string | null
  scope: string | null
  canReadReports: boolean
  canReadAll: boolean
}

/**
 * 時間外集計の絞り込みフォーム。native な GET フォームで ?month=&scope= へ遷移する。
 * scope の選択肢は権限に応じて出し分ける（本人のみ / 配下 / 全社）。
 */
export function OvertimeFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="overtime-month">月</Label>

        <Input
          id="overtime-month"
          name="month"
          type="month"
          defaultValue={props.month ?? ""}
          className="w-44"
        />
      </div>

      {props.canReadReports || props.canReadAll ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="overtime-scope">範囲</Label>

          <NativeSelect
            id="overtime-scope"
            name="scope"
            defaultValue={props.scope ?? ""}
            className="w-40"
          >
            <NativeSelectOption value="">本人のみ</NativeSelectOption>

            {props.canReadReports ? (
              <NativeSelectOption value="reports">配下</NativeSelectOption>
            ) : null}

            {props.canReadAll ? <NativeSelectOption value="all">全社</NativeSelectOption> : null}
          </NativeSelect>
        </div>
      ) : null}

      <Button type="submit" variant="outline">
        表示
      </Button>
    </form>
  )
}
