import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  kind: string | null
  status: string | null
}

/**
 * 物品の絞り込みフォーム。native な GET フォームで ?kind=&status= へ遷移する。
 * searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
 */
export function AssetFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl bg-card border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-kind">種別</Label>

        <NativeSelect id="filter-kind" name="kind" defaultValue={props.kind ?? ""} className="w-40">
          <NativeSelectOption value="">すべて</NativeSelectOption>
          <NativeSelectOption value="pc">PC</NativeSelectOption>
          <NativeSelectOption value="monitor">モニター</NativeSelectOption>
          <NativeSelectOption value="furniture">什器</NativeSelectOption>
          <NativeSelectOption value="other">その他</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-status">状態</Label>

        <NativeSelect
          id="filter-status"
          name="status"
          defaultValue={props.status ?? ""}
          className="w-40"
        >
          <NativeSelectOption value="">すべて</NativeSelectOption>
          <NativeSelectOption value="in_stock">在庫</NativeSelectOption>
          <NativeSelectOption value="lent">貸与中</NativeSelectOption>
        </NativeSelect>
      </div>

      <Button type="submit" variant="secondary">
        絞り込む
      </Button>
    </form>
  )
}
