import type { ItIncidentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  occurredAt: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.enum(["open", "resolved"]),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** インシデント記録。発生日時・概要・解消日時の事実のみ持ち、原因分析や再発防止判定はしない。 */
export class ItIncident implements Props {
  readonly id!: Props["id"]

  readonly occurredAt!: Props["occurredAt"]

  readonly title!: Props["title"]

  readonly summary!: Props["summary"]

  readonly severity!: Props["severity"]

  readonly status!: Props["status"]

  readonly resolvedAt!: Props["resolvedAt"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規のインシデント記録を組み立てる。id は未採番、status は open。 */
  static create(props: {
    occurredAt: string
    title: string
    summary: string
    severity: string | null
    createdAt: string
  }): ItIncident {
    return new ItIncident({
      id: null,
      occurredAt: props.occurredAt,
      title: props.title,
      summary: props.summary,
      severity: props.severity,
      status: "open",
      resolvedAt: null,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ItIncidentRow): ItIncident {
    return new ItIncident({
      id: row.id,
      occurredAt: row.occurredAt,
      title: row.title,
      summary: row.summary,
      severity: row.severity,
      status: toStatus(row.status),
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    })
  }

  /** 指定日時に解消済みへ倒した写しを返す。既に解消済みなら解消日時は保つ。 */
  resolve(resolvedAt: string): ItIncident {
    if (this.status === "resolved") {
      return this
    }

    return new ItIncident({ ...this.props, status: "resolved", resolvedAt: resolvedAt })
  }
}

/** DB の status 文字列を許容値に正規化する。未知値は open に倒す。 */
function toStatus(value: string): Props["status"] {
  return value === "resolved" ? "resolved" : "open"
}
