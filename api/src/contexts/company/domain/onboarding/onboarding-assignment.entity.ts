import { OnboardingTask } from "@/contexts/company/domain/onboarding/onboarding-task.entity"
import type { OnboardingTemplate } from "@/contexts/company/domain/onboarding/onboarding-template.entity"
import type { OnboardingAssignmentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  templateCode: z.string(),
  kind: z.enum(["join", "leave"]),
  status: z.enum(["in_progress", "completed"]),
  assignedAt: z.string(),
  tasks: z.array(z.instanceof(OnboardingTask)).readonly(),
})

type Props = z.infer<typeof zProps>

/** 入社/退職手続きの割り当て。OnboardingTask を内包する集約ルート。 */
export class OnboardingAssignment implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly templateCode!: Props["templateCode"]

  readonly kind!: Props["kind"]

  readonly status!: Props["status"]

  readonly assignedAt!: Props["assignedAt"]

  readonly tasks!: Props["tasks"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /**
   * テンプレートから割り当てを組み立てる。id は未採番、状態は in_progress。
   * テンプレートのタスク定義を割り当てタスクへ展開して内包する。
   */
  static create(props: {
    employeeId: number
    template: OnboardingTemplate
    assignedAt: string
  }): OnboardingAssignment {
    const tasks = props.template.tasks.map((task) =>
      OnboardingTask.create({
        templateTaskCode: task.code,
        title: task.title,
        order: task.order,
      }),
    )

    return new OnboardingAssignment({
      id: null,
      employeeId: props.employeeId,
      templateCode: props.template.code,
      kind: props.template.kind,
      status: "in_progress",
      assignedAt: props.assignedAt,
      tasks,
    })
  }

  static fromRow(
    row: OnboardingAssignmentRow,
    tasks: ReadonlyArray<OnboardingTask>,
  ): OnboardingAssignment {
    return new OnboardingAssignment({
      id: row.id,
      employeeId: row.employeeId,
      templateCode: row.templateCode,
      kind: row.kind === "leave" ? "leave" : "join",
      status: row.status === "completed" ? "completed" : "in_progress",
      assignedAt: row.assignedAt,
      tasks,
    })
  }

  /** 指定タスクを完了済みにした割り当てを返す。 */
  completeTask(taskId: number, completedAt: string) {
    const tasks = this.tasks.map((task) => (task.id === taskId ? task.complete(completedAt) : task))

    return new OnboardingAssignment({ ...this.props, tasks }).withRecomputedStatus()
  }

  /** 指定タスクの完了を取り消した割り当てを返す。 */
  uncompleteTask(taskId: number) {
    const tasks = this.tasks.map((task) => (task.id === taskId ? task.uncomplete() : task))

    return new OnboardingAssignment({ ...this.props, tasks }).withRecomputedStatus()
  }

  /** 割当日を変更した割り当てを返す。 */
  withRescheduled(assignedAt: string) {
    return new OnboardingAssignment({ ...this.props, assignedAt })
  }

  /** 内包タスクの完了状況から割り当ての状態を再計算した割り当てを返す。 */
  withRecomputedStatus() {
    const hasPending = this.tasks.some((task) => task.status !== "done")

    const status: Props["status"] = hasPending ? "in_progress" : "completed"

    return new OnboardingAssignment({ ...this.props, status })
  }

  updateStatus(status: Props["status"]) {
    return new OnboardingAssignment({ ...this.props, status })
  }
}
