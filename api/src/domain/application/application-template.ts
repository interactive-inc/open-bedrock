import type { ApplicationTemplateRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schemaJson: z.unknown(),
  approverRoles: z.array(z.string()).readonly(),
})

type Props = z.infer<typeof zProps>

// 申請テンプレート（申請の種別ごとの定義）。集約ルート。
export class ApplicationTemplate implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly category!: Props["category"]

  readonly description!: Props["description"]

  readonly schemaJson!: Props["schemaJson"]

  readonly approverRoles!: Props["approverRoles"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: ApplicationTemplateRow): ApplicationTemplate {
    return new ApplicationTemplate({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
      schemaJson: JSON.parse(row.schemaJson),
      approverRoles: JSON.parse(row.approverRoles),
    })
  }
}
