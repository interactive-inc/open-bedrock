import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = {
  kind: string | null
  status: string | null
}

// 物品の絞り込みフォーム。native な GET フォームで ?kind=&status= へ遷移する。
// searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
export function AssetFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-kind">種別</Label>

        <select
          id="filter-kind"
          name="kind"
          defaultValue={props.kind ?? ""}
          className="h-8 w-40 min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">すべて</option>
          <option value="pc">PC</option>
          <option value="monitor">モニター</option>
          <option value="furniture">什器</option>
          <option value="other">その他</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-status">状態</Label>

        <select
          id="filter-status"
          name="status"
          defaultValue={props.status ?? ""}
          className="h-8 w-40 min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">すべて</option>
          <option value="in_stock">在庫</option>
          <option value="lent">貸与中</option>
        </select>
      </div>

      <Button type="submit" variant="outline">
        絞り込む
      </Button>
    </form>
  )
}
