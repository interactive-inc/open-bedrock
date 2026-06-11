import type { SalaryRevisionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  effectiveDate: z.string(),
  previousBaseSalary: z.number(),
  newBaseSalary: z.number(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 給与改定（社員ごとの基本給改定履歴）。集約ルート。
export class SalaryRevision implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly effectiveDate!: Props["effectiveDate"]

  readonly previousBaseSalary!: Props["previousBaseSalary"]

  readonly newBaseSalary!: Props["newBaseSalary"]

  readonly reason!: Props["reason"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の給与改定を組み立てる。id は未採番。
  static create(props: {
    employeeId: number
    effectiveDate: string
    previousBaseSalary: number
    newBaseSalary: number
    reason: string | null
    createdAt: string
  }): SalaryRevision {
    return new SalaryRevision({
      id: null,
      employeeId: props.employeeId,
      effectiveDate: props.effectiveDate,
      previousBaseSalary: props.previousBaseSalary,
      newBaseSalary: props.newBaseSalary,
      reason: props.reason,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: SalaryRevisionRow): SalaryRevision {
    return new SalaryRevision({
      id: row.id,
      employeeId: row.employeeId,
      effectiveDate: row.effectiveDate,
      previousBaseSalary: row.previousBaseSalary,
      newBaseSalary: row.newBaseSalary,
      reason: row.reason,
      createdAt: row.createdAt,
    })
  }

  // 改定後基本給を訂正した新しい給与改定を返す。
  withNewBaseSalary(newBaseSalary: number): SalaryRevision {
    return new SalaryRevision({ ...this.props, newBaseSalary })
  }

  // 適用日を訂正した新しい給与改定を返す。
  withEffectiveDate(effectiveDate: string): SalaryRevision {
    return new SalaryRevision({ ...this.props, effectiveDate })
  }

  // 理由を訂正した新しい給与改定を返す。
  withReason(reason: string | null): SalaryRevision {
    return new SalaryRevision({ ...this.props, reason })
  }

  // 前回基本給を訂正した新しい給与改定を返す。適用日変更で時系列が変わったときに使う。
  withPreviousBaseSalary(previousBaseSalary: number): SalaryRevision {
    return new SalaryRevision({ ...this.props, previousBaseSalary })
  }
}
