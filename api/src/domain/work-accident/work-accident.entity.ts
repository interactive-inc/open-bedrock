import type { WorkAccidentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  occurredOn: z.string(),
  employeeId: z.number().nullable(),
  location: z.string().nullable(),
  summary: z.string(),
  severity: z.enum(["minor", "serious"]).nullable(),
  status: z.enum(["reported", "closed"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 労災・事故の発生記録。起きた事実の時系列記録のみ（法的な労災認定判定はしない）。
 * 対象者が特定されない事故もあるため employeeId は null 可。
 */
export class WorkAccident implements Props {
  readonly id!: Props["id"]

  readonly occurredOn!: Props["occurredOn"]

  readonly employeeId!: Props["employeeId"]

  readonly location!: Props["location"]

  readonly summary!: Props["summary"]

  readonly severity!: Props["severity"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: WorkAccidentRow): WorkAccident {
    return new WorkAccident({
      id: row.id,
      occurredOn: row.occurredOn,
      employeeId: row.employeeId,
      location: row.location,
      summary: row.summary,
      severity: row.severity === null ? null : zProps.shape.severity.parse(row.severity),
      status: zProps.shape.status.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  /** reported のときだけ closed へ進めた新しい記録を返す。 */
  withClosed(): WorkAccident | { reason: "invalid_transition" } {
    if (this.status !== "reported") {
      return { reason: "invalid_transition" }
    }

    return new WorkAccident({ ...this.props, status: "closed" })
  }
}
