import type { DisciplinaryActionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  kind: z.string(),
  summary: z.string(),
  decidedOn: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）。id は新規作成時 null。 */
export class DisciplinaryAction implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly kind!: Props["kind"]

  readonly summary!: Props["summary"]

  readonly decidedOn!: Props["decidedOn"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    employeeId: number
    kind: string
    summary: string
    decidedOn: string
    createdAt: string
  }): DisciplinaryAction {
    return new DisciplinaryAction({
      id: null,
      employeeId: props.employeeId,
      kind: props.kind,
      summary: props.summary,
      decidedOn: props.decidedOn,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: DisciplinaryActionRow): DisciplinaryAction {
    return new DisciplinaryAction({
      id: row.id,
      employeeId: row.employeeId,
      kind: row.kind,
      summary: row.summary,
      decidedOn: row.decidedOn,
      createdAt: row.createdAt,
    })
  }
}
