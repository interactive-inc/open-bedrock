import type { EvaluationSheetRow } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { z } from "zod"

export const evaluationSheetStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "rejected",
  "approved",
  "self_eval",
  "primary_eval",
  "secondary_eval",
  "finalized",
  "archived",
  "reopened",
])

export type EvaluationSheetStatus = z.infer<typeof evaluationSheetStatusSchema>

/** ステータス遷移テーブル。各 status からの遷移先一覧。 */
const VALID_TRANSITIONS: Record<EvaluationSheetStatus, ReadonlyArray<EvaluationSheetStatus>> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  rejected: ["draft"],
  approved: ["self_eval"],
  self_eval: ["primary_eval"],
  primary_eval: ["secondary_eval", "finalized"],
  secondary_eval: ["finalized"],
  finalized: ["reopened", "archived"],
  archived: [],
  reopened: ["self_eval"],
}

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  templateId: z.number().nullable(),
  period: z.string().min(1).max(100),
  status: evaluationSheetStatusSchema,
  primaryEvaluatorId: z.number(),
  secondaryEvaluatorId: z.number().nullable(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  finalizedAt: z.string().nullable(),
  revision: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 評価シート（評価期 × 社員。MBO の中心エンティティ）。集約ルート。 */
export class EvaluationSheet implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly templateId!: Props["templateId"]

  readonly period!: Props["period"]

  readonly status!: Props["status"]

  readonly primaryEvaluatorId!: Props["primaryEvaluatorId"]

  readonly secondaryEvaluatorId!: Props["secondaryEvaluatorId"]

  readonly submittedAt!: Props["submittedAt"]

  readonly approvedAt!: Props["approvedAt"]

  readonly finalizedAt!: Props["finalizedAt"]

  readonly revision!: Props["revision"]

  readonly createdAt!: Props["createdAt"]

  readonly updatedAt!: Props["updatedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    employeeId: number
    templateId: number | null
    period: string
    primaryEvaluatorId: number
    secondaryEvaluatorId: number | null
    now: string
  }): EvaluationSheet {
    return new EvaluationSheet({
      id: null,
      employeeId: props.employeeId,
      templateId: props.templateId,
      period: props.period,
      status: "draft",
      primaryEvaluatorId: props.primaryEvaluatorId,
      secondaryEvaluatorId: props.secondaryEvaluatorId,
      submittedAt: null,
      approvedAt: null,
      finalizedAt: null,
      revision: 1,
      createdAt: props.now,
      updatedAt: props.now,
    })
  }

  static fromRow(row: EvaluationSheetRow): EvaluationSheet {
    return new EvaluationSheet({
      id: row.id,
      employeeId: row.employeeId,
      templateId: row.templateId,
      period: row.period,
      status: evaluationSheetStatusSchema.parse(row.status),
      primaryEvaluatorId: row.primaryEvaluatorId,
      secondaryEvaluatorId: row.secondaryEvaluatorId,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      finalizedAt: row.finalizedAt,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  /** 指定ステータスへの遷移が有効か判定する。 */
  canTransitionTo(next: EvaluationSheetStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(next)
  }

  /**
   * ステータスを遷移させた写しを返す。遷移不正なら null。
   * revision をインクリメントし、楽観的ロックの競合を次回の update で検出可能にする。
   */
  transition(next: EvaluationSheetStatus, now: string): EvaluationSheet | null {
    if (this.canTransitionTo(next) === false) {
      return null
    }

    const timestamps: Partial<Props> = { updatedAt: now }

    if (next === "pending_approval") {
      timestamps.submittedAt = now
    }

    if (next === "approved") {
      timestamps.approvedAt = now
    }

    if (next === "finalized") {
      timestamps.finalizedAt = now
    }

    return new EvaluationSheet({
      ...this.props,
      status: next,
      revision: this.revision + 1,
      ...timestamps,
    })
  }

  /**
   * 評価者を変更した写しを返す（HR/admin 用）。
   * revision をインクリメントする。
   */
  withEvaluators(props: {
    primaryEvaluatorId: number
    secondaryEvaluatorId: number | null
    now: string
  }): EvaluationSheet {
    return new EvaluationSheet({
      ...this.props,
      primaryEvaluatorId: props.primaryEvaluatorId,
      secondaryEvaluatorId: props.secondaryEvaluatorId,
      revision: this.revision + 1,
      updatedAt: props.now,
    })
  }
}
