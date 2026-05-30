import { OnboardingTemplateTask } from "@/domain/onboarding/onboarding-template-task"
import type { OnboardingTemplateRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["join", "leave"]),
  description: z.string().nullable(),
  tasks: z.array(z.instanceof(OnboardingTemplateTask)).readonly(),
})

type Props = z.infer<typeof zProps>

// 入社/退職手続きのテンプレート（チェックリストの雛形）。読み取り中心のマスタ集約。
export class OnboardingTemplate implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly kind!: Props["kind"]

  readonly description!: Props["description"]

  readonly tasks!: Props["tasks"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(
    row: OnboardingTemplateRow,
    tasks: ReadonlyArray<OnboardingTemplateTask>,
  ): OnboardingTemplate {
    return new OnboardingTemplate({
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind === "leave" ? "leave" : "join",
      description: row.description,
      tasks,
    })
  }
}
