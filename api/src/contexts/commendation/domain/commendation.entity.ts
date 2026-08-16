import type { CommendationRow } from "@/contexts/commendation/infrastructure/schema/commendation"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  title: z.string(),
  reason: z.string(),
  awardedOn: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 表彰の記録（社内公開。判定や評価計算は持たず事実の記録のみ）。id は新規作成時 null。 */
export class Commendation implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly title!: Props["title"]

  readonly reason!: Props["reason"]

  readonly awardedOn!: Props["awardedOn"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    employeeId: number
    title: string
    reason: string
    awardedOn: string
    createdAt: string
  }): Commendation {
    return new Commendation({
      id: null,
      employeeId: props.employeeId,
      title: props.title,
      reason: props.reason,
      awardedOn: props.awardedOn,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: CommendationRow): Commendation {
    return new Commendation({
      id: row.id,
      employeeId: row.employeeId,
      title: row.title,
      reason: row.reason,
      awardedOn: row.awardedOn,
      createdAt: row.createdAt,
    })
  }
}
