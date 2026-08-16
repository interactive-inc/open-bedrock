import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/onboarding-template-task.entity"
import type { OnboardingTemplateRow } from "@/contexts/onboarding/infrastructure/schema/onboarding"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["join", "leave"]),
  description: z.string().nullable(),
  tasks: z.array(z.instanceof(OnboardingTemplateTask)).readonly(),
})

type Props = z.infer<typeof zProps>

/** 入社/退職手続きのテンプレート（チェックリストの雛形）。読み取り中心のマスタ集約。 */
export class OnboardingTemplate implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
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

  /** 新規テンプレートを組み立てる。id は未採番、tasks は空で作成する。 */
  static create(props: {
    code: string
    name: string
    kind: "join" | "leave"
    description: string | null
  }): OnboardingTemplate {
    return new OnboardingTemplate({
      id: null,
      code: props.code,
      name: props.name,
      kind: props.kind,
      description: props.description,
      tasks: [],
    })
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

  /** 名称・種別・説明を変更した新しいテンプレートを返す。code と tasks は保つ。 */
  withDetails(props: {
    name: string
    kind: "join" | "leave"
    description: string | null
  }): OnboardingTemplate {
    return new OnboardingTemplate({
      ...this.props,
      name: props.name,
      kind: props.kind,
      description: props.description,
    })
  }
}
