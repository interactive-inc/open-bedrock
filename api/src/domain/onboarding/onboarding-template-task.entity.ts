import type { OnboardingTemplateTaskRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  code: z.string(),
  title: z.string(),
  order: z.number(),
  ownerRole: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

/** テンプレートに含まれるタスク定義（並び順・担当ロール）。 */
export class OnboardingTemplateTask implements Props {
  readonly code!: Props["code"]

  readonly title!: Props["title"]

  readonly order!: Props["order"]

  readonly ownerRole!: Props["ownerRole"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: OnboardingTemplateTaskRow): OnboardingTemplateTask {
    return new OnboardingTemplateTask({
      code: row.code,
      title: row.title,
      order: row.sortOrder,
      ownerRole: row.ownerRole,
    })
  }
}
