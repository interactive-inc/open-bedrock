import type { HealthCheckupRow } from "@/contexts/health-checkup/infrastructure/schema/health-checkup"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  employeeId: z.number(),
  fiscalYear: z.number(),
  checkupKind: z.enum(["regular", "stress_check"]),
  conductedOn: z.string().nullable(),
  status: z.enum(["scheduled", "completed", "declined"]),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 健康診断・ストレスチェックの実施記録。要配慮個人情報である「結果」は絶対に持たない。
 * 実施年度・種別・実施日・受診状態の記録にとどめる。
 */
export class HealthCheckup implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly fiscalYear!: Props["fiscalYear"]

  readonly checkupKind!: Props["checkupKind"]

  readonly conductedOn!: Props["conductedOn"]

  readonly status!: Props["status"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: HealthCheckupRow): HealthCheckup {
    return new HealthCheckup({
      id: row.id,
      employeeId: row.employeeId,
      fiscalYear: row.fiscalYear,
      checkupKind: zProps.shape.checkupKind.parse(row.checkupKind),
      conductedOn: row.conductedOn,
      status: zProps.shape.status.parse(row.status),
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** scheduled のときだけ completed へ進め、実施日を記録した新しい記録を返す。 */
  withCompleted(conductedOn: string): HealthCheckup | { reason: "invalid_transition" } {
    if (this.status !== "scheduled") {
      return { reason: "invalid_transition" }
    }

    return new HealthCheckup({ ...this.props, status: "completed", conductedOn })
  }
}
