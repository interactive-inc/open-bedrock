import type { AssetRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchasedOn: z.string().nullable(),
  status: z.string(),
  holderEmployeeId: z.number().nullable(),
})

type Props = z.infer<typeof zProps>

/** 資産台帳の1件（在庫/貸出状態と保有者を持つ）。集約ルート。 */
export class Asset implements Props {
  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly kind!: Props["kind"]

  readonly serial!: Props["serial"]

  readonly purchasedOn!: Props["purchasedOn"]

  readonly status!: Props["status"]

  readonly holderEmployeeId!: Props["holderEmployeeId"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規登録する資産を組み立てる。初期状態は在庫・保有者なし。 */
  static create(props: {
    code: string
    name: string
    kind: string
    serial: string | null
    purchasedOn: string | null
  }): Asset {
    return new Asset({
      code: props.code,
      name: props.name,
      kind: props.kind,
      serial: props.serial,
      purchasedOn: props.purchasedOn,
      status: "in_stock",
      holderEmployeeId: null,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: AssetRow): Asset {
    return new Asset({
      code: row.code,
      name: row.name,
      kind: row.kind,
      serial: row.serial,
      purchasedOn: row.purchasedOn,
      status: row.status,
      holderEmployeeId: row.holderEmployeeId,
    })
  }

  /** 名称・種別・シリアル・購入日を差し替える。在庫/貸出状態と保有者は保つ。 */
  withDetails(details: {
    name: Props["name"]
    kind: Props["kind"]
    serial: Props["serial"]
    purchasedOn: Props["purchasedOn"]
  }) {
    return new Asset({
      ...this.props,
      name: details.name,
      kind: details.kind,
      serial: details.serial,
      purchasedOn: details.purchasedOn,
    })
  }
}
