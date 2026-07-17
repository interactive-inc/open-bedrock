import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  q: string | null
  status: string | null
}

// 取引先の絞り込みフォーム。native な GET フォームで ?q=&status= へ遷移する。
// searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
export function PartnerFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-q">キーワード</Label>

        <Input
          id="filter-q"
          name="q"
          defaultValue={props.q ?? ""}
          placeholder="名称・コード"
          className="w-56"
        />
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
          <option value="active">取引中</option>
          <option value="archived">終了</option>
        </select>
      </div>

      <Button type="submit" variant="outline">
        絞り込む
      </Button>
    </form>
  )
}
