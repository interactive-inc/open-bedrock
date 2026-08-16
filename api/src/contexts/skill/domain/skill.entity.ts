import type { SkillRow } from "@/contexts/skill/infrastructure/schema/skill"
import { z } from "zod"

const zProps = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
})

type Props = z.infer<typeof zProps>

/** スキルマスタの1件（コード・名称・分類）。集約ルート。 */
export class Skill implements Props {
  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly category!: Props["category"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: SkillRow): Skill {
    return new Skill({
      code: row.code,
      name: row.name,
      category: row.category,
    })
  }
}
