import type { CareerSheetRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  employeeId: z.number(),
  goalsText: z.string().nullable(),
  strengthsText: z.string().nullable(),
  updatedAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 社員ごとのキャリアシート（目標・強み）。employeeId が主キーの集約ルート。
export class CareerSheet implements Props {
  readonly employeeId!: Props["employeeId"]

  readonly goalsText!: Props["goalsText"]

  readonly strengthsText!: Props["strengthsText"]

  readonly updatedAt!: Props["updatedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 本人のキャリアシートを組み立てる。employeeId が主キーのためすべて指定する。
  static create(props: {
    employeeId: number
    goalsText: string | null
    strengthsText: string | null
    updatedAt: string
  }): CareerSheet {
    return new CareerSheet({
      employeeId: props.employeeId,
      goalsText: props.goalsText,
      strengthsText: props.strengthsText,
      updatedAt: props.updatedAt,
    })
  }

  // 永続化された行から復元する。
  static fromRow(row: CareerSheetRow): CareerSheet {
    return new CareerSheet({
      employeeId: row.employeeId,
      goalsText: row.goalsText,
      strengthsText: row.strengthsText,
      updatedAt: row.updatedAt,
    })
  }
}
