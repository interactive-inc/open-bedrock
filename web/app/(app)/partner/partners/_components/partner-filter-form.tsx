import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  q: string | null
  status: string | null
}

/**
 * 取引先の絞り込みフォーム。native な GET フォームで ?q=&status= へ遷移する。
 * searchParams を更新するだけなので Server Action を使わず method="get" のままにする。
 */
export function PartnerFilterForm(props: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-2xl bg-card border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-q">キーワード</Label>

        <Input id="filter-q" name="q" defaultValue={props.q ?? ""} placeholder="名称・コード" />
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
          <NativeSelectOption value="active">取引中</NativeSelectOption>
          <NativeSelectOption value="archived">終了</NativeSelectOption>
        </NativeSelect>
      </div>

      <Button type="submit" variant="secondary">
        絞り込む
      </Button>
    </form>
  )
}
