import type { StocktakeRow } from "@/schema"
import { z } from "zod"

/** D1 の RETURNING 行を安全にパースする。fromRow の引数型に対応する。 */
export const stocktakeRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetDate: z.string(),
  status: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
})

const zProps = z.object({
  id: z.string(),
  name: z.string(),
  targetDate: z.string(),
  status: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

/** 棚卸しセッション（対象日ごとに現物確認を束ねる）。open→closed の遷移を持つ。集約ルート。 */
export class Stocktake implements Props {
  /** id は UUID。新規作成時に採番する。 */
  readonly id!: Props["id"]

  readonly name!: Props["name"]

  readonly targetDate!: Props["targetDate"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  readonly closedAt!: Props["closedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規棚卸しセッションを組み立てる。id は crypto.randomUUID() で採番し、status は "open"。 */
  static create(props: { name: string; targetDate: string; createdAt: string }): Stocktake {
    return new Stocktake({
      id: crypto.randomUUID(),
      name: props.name,
      targetDate: props.targetDate,
      status: "open",
      createdAt: props.createdAt,
      closedAt: null,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: StocktakeRow): Stocktake {
    return new Stocktake({
      id: row.id,
      name: row.name,
      targetDate: row.targetDate,
      status: row.status,
      createdAt: row.createdAt,
      closedAt: row.closedAt,
    })
  }

  /** 締めて closed に遷移する。締めた時刻を記録する。 */
  withClosed(closedAt: string) {
    return new Stocktake({
      ...this.props,
      status: "closed",
      closedAt: closedAt,
    })
  }
}
