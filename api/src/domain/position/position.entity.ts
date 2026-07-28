import type { PositionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  rank: z.number().int(),
  description: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 役職マスタ（並び順の rank を持つ役職の定義。判定・計算は持たず定義のみ）。集約ルート。 */
export class Position implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly rank!: Props["rank"]

  readonly description!: Props["description"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する役職を組み立てる。id は未採番。 */
  static create(props: {
    code: string
    name: string
    rank: number
    description: string | null
    createdAt: string
  }): Position {
    return new Position({
      id: null,
      code: props.code,
      name: props.name,
      rank: props.rank,
      description: props.description,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: PositionRow): Position {
    return new Position({
      id: row.id,
      code: row.code,
      name: row.name,
      rank: row.rank,
      description: row.description,
      createdAt: row.createdAt,
    })
  }

  /** 役職の定義（コード・名称・並び順・説明）を差し替えた写しを返す。 */
  withDetails(props: {
    code: Props["code"]
    name: Props["name"]
    rank: Props["rank"]
    description: Props["description"]
  }): Position {
    return new Position({
      ...this.props,
      code: props.code,
      name: props.name,
      rank: props.rank,
      description: props.description,
    })
  }
}
