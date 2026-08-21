import type { RegulationRow } from "@/contexts/regulation/infrastructure/schema/regulation"
import { z } from "zod"

export const regulationStatusSchema = z.enum(["active", "archived"])

export type RegulationStatus = z.infer<typeof regulationStatusSchema>

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: regulationStatusSchema,
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 規程集の1件（版は regulation_versions が持つ）。id は新規作成時 null。 */
export class Regulation implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly title!: Props["title"]

  readonly category!: Props["category"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規規程を組み立てる。id は未採番、初期状態は active。 */
  static create(props: {
    code: string
    title: string
    category: string | null
    createdAt: string
  }): Regulation {
    return new Regulation({
      id: null,
      code: props.code,
      title: props.title,
      category: props.category,
      status: "active",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RegulationRow): Regulation {
    return new Regulation({
      id: row.id,
      code: row.code,
      title: row.title,
      category: row.category,
      status: toRegulationStatus(row.status),
      createdAt: row.createdAt,
    })
  }

  /** アーカイブ状態にした規程を返す。 */
  archive(): Regulation {
    return new Regulation({
      ...this.props,
      status: "archived",
    })
  }
}

/** DB の status 文字列を許容値へ寄せる。未知値は active とみなす。 */
function toRegulationStatus(value: string): Props["status"] {
  return value === "archived" ? "archived" : "active"
}
