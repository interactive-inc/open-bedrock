import type { GoalEvaluationRow } from "@/contexts/performance-review/infrastructure/schema/goal"
import { z } from "zod"

export const goalEvaluationKindSchema = z.enum(["self", "manager", "final"])

export type GoalEvaluationKind = z.infer<typeof goalEvaluationKindSchema>

const zProps = z.object({
  id: z.number().nullable(),
  goalId: z.number(),
  evaluatorId: z.number(),
  kind: goalEvaluationKindSchema,
  score: z.number().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 目標への評価（自己・上長・最終）。集約ルート。 */
export class GoalEvaluation implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly goalId!: Props["goalId"]

  readonly evaluatorId!: Props["evaluatorId"]

  readonly kind!: Props["kind"]

  readonly score!: Props["score"]

  readonly comment!: Props["comment"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する評価を組み立てる。id は未採番。 */
  static create(props: {
    goalId: number
    evaluatorId: number
    kind: GoalEvaluationKind
    score: number | null
    comment: string | null
    createdAt: string
  }): GoalEvaluation {
    return new GoalEvaluation({
      id: null,
      goalId: props.goalId,
      evaluatorId: props.evaluatorId,
      kind: props.kind,
      score: props.score,
      comment: props.comment,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: GoalEvaluationRow): GoalEvaluation {
    return new GoalEvaluation({
      id: row.id,
      goalId: row.goalId,
      evaluatorId: row.evaluatorId,
      kind: goalEvaluationKindSchema.parse(row.kind),
      score: row.score,
      comment: row.comment,
      createdAt: row.createdAt,
    })
  }
}
