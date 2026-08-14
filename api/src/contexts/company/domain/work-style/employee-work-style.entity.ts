import type { EmployeeWorkStyleRow } from "@/schema"
import { workStyleSchema } from "@/lib/schemas"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  style: workStyleSchema,
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 従業員の勤務形態の期間つき記録。制度の適法性判定はせず、区分の記録のみ。 */
export class EmployeeWorkStyle implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly style!: Props["style"]

  readonly startsOn!: Props["startsOn"]

  readonly endsOn!: Props["endsOn"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する勤務形態の記録を組み立てる。id は未採番。 */
  static create(props: {
    employeeId: number
    style: Props["style"]
    startsOn: string
    endsOn: string | null
    note: string | null
    createdAt: string
  }): EmployeeWorkStyle {
    return new EmployeeWorkStyle({
      id: null,
      employeeId: props.employeeId,
      style: props.style,
      startsOn: props.startsOn,
      endsOn: props.endsOn,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: EmployeeWorkStyleRow): EmployeeWorkStyle {
    return new EmployeeWorkStyle({
      id: row.id,
      employeeId: row.employeeId,
      style: row.style,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      note: row.note,
      createdAt: row.createdAt,
    })
  }
}
