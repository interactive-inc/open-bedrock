import type { MeetingRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  cadence: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 会議体マスタ。id は新規作成時 null、DB 採番後に確定する。 */
export class Meeting implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly cadence!: Props["cadence"]

  readonly description!: Props["description"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規会議体を組み立てる。id は未採番のため null、status は active。 */
  static create(props: {
    code: string
    name: string
    cadence: string | null
    description: string | null
    createdAt: string
  }): Meeting {
    return new Meeting({
      id: null,
      code: props.code,
      name: props.name,
      cadence: props.cadence,
      description: props.description,
      status: "active",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: MeetingRow): Meeting {
    return new Meeting({
      id: row.id,
      code: row.code,
      name: row.name,
      cadence: row.cadence,
      description: row.description,
      status: row.status === "archived" ? "archived" : "active",
      createdAt: row.createdAt,
    })
  }

  /** 名称・頻度・説明を更新した新しい会議体を返す。 */
  withContent(props: {
    name: string
    cadence: string | null
    description: string | null
  }): Meeting {
    return new Meeting({
      ...this.props,
      name: props.name,
      cadence: props.cadence,
      description: props.description,
    })
  }

  /** status を archived にした新しい会議体を返す。 */
  archive(): Meeting {
    return new Meeting({
      ...this.props,
      status: "archived",
    })
  }
}
