import type { ApplicationTemplateRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
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
  // 永続化前は null、DB 採番後に確定する。
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

  // 新規作成する申請テンプレートを組み立てる。id は未採番。
  static create(props: {
    code: string
    name: string
    category: string
    description: string | null
    schemaJson: unknown
    approverRoles: ReadonlyArray<string>
  }): ApplicationTemplate {
    return new ApplicationTemplate({
      id: null,
      code: props.code,
      name: props.name,
      category: props.category,
      description: props.description,
      schemaJson: props.schemaJson,
      approverRoles: props.approverRoles,
    })
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

  // 内容（名称・カテゴリ・説明・スキーマ・承認ロール）を変更した新しいテンプレートを返す。code は保つ。
  withDetails(props: {
    name: string
    category: string
    description: string | null
    schemaJson: unknown
    approverRoles: ReadonlyArray<string>
  }): ApplicationTemplate {
    return new ApplicationTemplate({
      ...this.props,
      name: props.name,
      category: props.category,
      description: props.description,
      schemaJson: props.schemaJson,
      approverRoles: props.approverRoles,
    })
  }
}
