import type { TrainingEnrollmentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  courseId: z.number(),
  employeeId: z.number(),
  status: z.enum(["enrolled", "completed", "failed"]),
  completedAt: z.string().nullable(),
  score: z.number().nullable(),
  dueDate: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 受講登録（社員ごとのコース受講状況・スコア・期限）。集約ルート。
export class TrainingEnrollment implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly courseId!: Props["courseId"]

  readonly employeeId!: Props["employeeId"]

  readonly status!: Props["status"]

  readonly completedAt!: Props["completedAt"]

  readonly score!: Props["score"]

  readonly dueDate!: Props["dueDate"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規受講登録を組み立てる。id は未採番、初期状態は enrolled。
  static create(props: {
    courseId: number
    employeeId: number
    dueDate: string | null
  }): TrainingEnrollment {
    return new TrainingEnrollment({
      id: null,
      courseId: props.courseId,
      employeeId: props.employeeId,
      status: "enrolled",
      completedAt: null,
      score: null,
      dueDate: props.dueDate,
    })
  }

  static fromRow(row: TrainingEnrollmentRow): TrainingEnrollment {
    return new TrainingEnrollment({
      id: row.id,
      courseId: row.courseId,
      employeeId: row.employeeId,
      status: toEnrollmentStatus(row.status),
      completedAt: row.completedAt,
      score: row.score,
      dueDate: row.dueDate,
    })
  }

  complete(completedAt: string, score: number | null) {
    return new TrainingEnrollment({
      ...this.props,
      status: "completed",
      completedAt,
      score,
    })
  }

  // 受講期限を変更した新しい受講登録を返す。
  withRescheduled(dueDate: string | null): TrainingEnrollment {
    return new TrainingEnrollment({
      ...this.props,
      dueDate,
    })
  }
}

function toEnrollmentStatus(status: string): "enrolled" | "completed" | "failed" {
  if (status === "completed") {
    return "completed"
  }

  if (status === "failed") {
    return "failed"
  }

  return "enrolled"
}
