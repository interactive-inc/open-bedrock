import type { OnboardingTaskRow } from "@/contexts/onboarding/infrastructure/schema/onboarding"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  assignmentId: z.number().nullable(),
  templateTaskCode: z.string(),
  title: z.string(),
  order: z.number(),
  status: z.enum(["pending", "done"]),
  completedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

/** 割り当てから展開された個別タスク。OnboardingAssignment 集約の子エンティティ。 */
export class OnboardingTask implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  /** 割り当てが未採番のあいだは null。 */
  readonly assignmentId!: Props["assignmentId"]

  readonly templateTaskCode!: Props["templateTaskCode"]

  readonly title!: Props["title"]

  readonly order!: Props["order"]

  readonly status!: Props["status"]

  readonly completedAt!: Props["completedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規タスクを組み立てる。id・assignmentId は未採番、状態は pending。 */
  static create(props: { templateTaskCode: string; title: string; order: number }): OnboardingTask {
    return new OnboardingTask({
      id: null,
      assignmentId: null,
      templateTaskCode: props.templateTaskCode,
      title: props.title,
      order: props.order,
      status: "pending",
      completedAt: null,
    })
  }

  static fromRow(row: OnboardingTaskRow): OnboardingTask {
    return new OnboardingTask({
      id: row.id,
      assignmentId: row.assignmentId,
      templateTaskCode: row.templateTaskCode,
      title: row.title,
      order: row.sortOrder,
      status: row.status === "done" ? "done" : "pending",
      completedAt: row.completedAt,
    })
  }

  complete(completedAt: string) {
    return new OnboardingTask({ ...this.props, status: "done", completedAt })
  }

  /** 完了を取り消し pending に戻したタスクを返す。 */
  uncomplete() {
    return new OnboardingTask({ ...this.props, status: "pending", completedAt: null })
  }
}
