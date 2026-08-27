import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { AssetRow } from "@/contexts/asset/infrastructure/schema/asset"
import { z } from "zod"

/** D1 batch の結果行を安全にパースする。fromRow の引数型に対応する。 */
export const assetRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchasedOn: z.string().nullable(),
  status: z.string(),
  holderEmployeeId: zEmployeeId.nullable(),
  disposedOn: z.string().nullable(),
  disposalReason: z.string().nullable(),
})

const zProps = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchasedOn: z.string().nullable(),
  status: z.string(),
  holderEmployeeId: zEmployeeId.nullable(),
  disposedOn: z.string().nullable(),
  disposalReason: z.string().nullable(),
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

  readonly disposedOn!: Props["disposedOn"]

  readonly disposalReason!: Props["disposalReason"]

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
      disposedOn: null,
      disposalReason: null,
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
      disposedOn: row.disposedOn,
      disposalReason: row.disposalReason,
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

  /** 廃棄済みに遷移する。理由・日付を記録し、保有者は外す。 */
  withDisposed(disposal: { disposedOn: string; reason: string }) {
    return new Asset({
      ...this.props,
      status: "disposed",
      holderEmployeeId: null,
      disposedOn: disposal.disposedOn,
      disposalReason: disposal.reason,
    })
  }
}
