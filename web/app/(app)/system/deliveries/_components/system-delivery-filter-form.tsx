import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"

type Props = {
  kind: string
  status: string | null
}

const kindOptions = [
  { value: "job", label: "ジョブ" },
  { value: "outbox", label: "送信箱" },
]

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "queued", label: "待機" },
  { value: "leased", label: "実行中" },
  { value: "succeeded", label: "成功" },
  { value: "dead_letter", label: "dead letter" },
]

/**
 * 配信一覧の絞り込み。api が kind を必須にするので「すべて」は置かず、
 * ジョブと送信箱のどちらかを必ず選ばせる。
 */
export function SystemDeliveryFilterForm(props: Props) {
  return (
    <form method="get" action="/system/deliveries">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="system-delivery-kind">種別</FieldLabel>

              <select
                id="system-delivery-kind"
                name="kind"
                defaultValue={props.kind}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {kindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="system-delivery-status">状態</FieldLabel>

              <select
                id="system-delivery-status"
                name="status"
                defaultValue={props.status ?? ""}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Button type="submit">絞り込み</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
