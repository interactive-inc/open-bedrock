import type { AssetLendingRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  assetCode: z.string(),
  employeeId: z.number(),
  lentAt: z.string(),
  returnedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 資産の貸出記録（open は returnedAt が null）。Asset 集約の内部エンティティ。
export class AssetLending implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly assetCode!: Props["assetCode"]

  readonly employeeId!: Props["employeeId"]

  readonly lentAt!: Props["lentAt"]

  readonly returnedAt!: Props["returnedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の貸出を組み立てる。id は未採番、未返却。
  static create(props: { assetCode: string; employeeId: number; lentAt: string }): AssetLending {
    return new AssetLending({
      id: null,
      assetCode: props.assetCode,
      employeeId: props.employeeId,
      lentAt: props.lentAt,
      returnedAt: null,
    })
  }

  // 永続化された行から復元する。
  static fromRow(row: AssetLendingRow): AssetLending {
    return new AssetLending({
      id: row.id,
      assetCode: row.assetCode,
      employeeId: row.employeeId,
      lentAt: row.lentAt,
      returnedAt: row.returnedAt,
    })
  }

  withReturnedAt(returnedAt: Props["returnedAt"]) {
    return new AssetLending({ ...this.props, returnedAt })
  }
}
