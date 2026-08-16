import type { DecisionRow } from "@/contexts/meeting/infrastructure/schema/meeting"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  decidedOn: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().nullable(),
  status: z.enum(["active", "superseded"]),
  supersededById: z.number().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 意思決定記録(ADR 形式)。id は新規作成時 null、DB 採番後に確定する。 */
export class Decision implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly decidedOn!: Props["decidedOn"]

  readonly context!: Props["context"]

  readonly decision!: Props["decision"]

  readonly consequences!: Props["consequences"]

  readonly status!: Props["status"]

  readonly supersededById!: Props["supersededById"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規決定を組み立てる。id は未採番のため null、status は active。 */
  static create(props: {
    title: string
    decidedOn: string
    context: string
    decision: string
    consequences: string | null
    createdAt: string
  }): Decision {
    return new Decision({
      id: null,
      title: props.title,
      decidedOn: props.decidedOn,
      context: props.context,
      decision: props.decision,
      consequences: props.consequences,
      status: "active",
      supersededById: null,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: DecisionRow): Decision {
    return new Decision({
      id: row.id,
      title: row.title,
      decidedOn: row.decidedOn,
      context: row.context,
      decision: row.decision,
      consequences: row.consequences,
      status: row.status === "superseded" ? "superseded" : "active",
      supersededById: row.supersededById,
      createdAt: row.createdAt,
    })
  }

  /** 表題・決定日・文脈・決定・帰結を更新した新しい決定を返す。 */
  withContent(props: {
    title: string
    decidedOn: string
    context: string
    decision: string
    consequences: string | null
  }): Decision {
    return new Decision({
      ...this.props,
      title: props.title,
      decidedOn: props.decidedOn,
      context: props.context,
      decision: props.decision,
      consequences: props.consequences,
    })
  }
}
