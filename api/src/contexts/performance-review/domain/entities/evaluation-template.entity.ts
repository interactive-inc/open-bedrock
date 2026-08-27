import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EvaluationTemplateRow } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { z } from "zod"

/** テンプレート項目（目標の雛形 1 行ぶん）。JSON 配列として items に格納される。 */
export const evaluationTemplateItemSchema = z.object({
  title: z.string().min(1),
  defaultWeight: z.number().int().min(1).max(100),
  kpiExample: z.string().nullable().optional(),
})

export type EvaluationTemplateItem = z.infer<typeof evaluationTemplateItemSchema>

export const evaluationTemplateStatusSchema = z.enum(["draft", "active", "archived"])

export type EvaluationTemplateStatus = z.infer<typeof evaluationTemplateStatusSchema>

/** テンプレートのステータス遷移テーブル。 */
const VALID_TEMPLATE_TRANSITIONS: Record<
  EvaluationTemplateStatus,
  ReadonlyArray<EvaluationTemplateStatus>
> = {
  draft: ["active"],
  active: ["archived"],
  archived: [],
}

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string().min(1).max(200),
  period: z.string().min(1).max(100),
  items: z.array(evaluationTemplateItemSchema).min(1),
  status: evaluationTemplateStatusSchema,
  createdBy: zEmployeeId,
  createdAt: z.string(),
  updatedAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 評価テンプレート（期間ごとの評価項目雛形）。集約ルート。 */
export class EvaluationTemplate implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly period!: Props["period"]

  readonly items!: Props["items"]

  readonly status!: Props["status"]

  readonly createdBy!: Props["createdBy"]

  readonly createdAt!: Props["createdAt"]

  readonly updatedAt!: Props["updatedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    title: string
    period: string
    items: ReadonlyArray<EvaluationTemplateItem>
    createdBy: EmployeeId
    now: string
  }): EvaluationTemplate {
    return new EvaluationTemplate({
      id: null,
      title: props.title,
      period: props.period,
      items: [...props.items],
      status: "draft",
      createdBy: props.createdBy,
      createdAt: props.now,
      updatedAt: props.now,
    })
  }

  static fromRow(row: EvaluationTemplateRow): EvaluationTemplate {
    return new EvaluationTemplate({
      id: row.id,
      title: row.title,
      period: row.period,
      items: z.array(evaluationTemplateItemSchema).parse(JSON.parse(row.items)),
      status: evaluationTemplateStatusSchema.parse(row.status),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  withDetails(props: {
    title: string
    period: string
    items: ReadonlyArray<EvaluationTemplateItem>
    now: string
  }) {
    return new EvaluationTemplate({
      ...this.props,
      title: props.title,
      period: props.period,
      items: [...props.items],
      updatedAt: props.now,
    })
  }

  /** 指定ステータスへの遷移が有効か判定する。 */
  canTransitionTo(next: EvaluationTemplateStatus): boolean {
    return VALID_TEMPLATE_TRANSITIONS[this.status].includes(next)
  }

  /** ステータスを遷移させた写しを返す。遷移不正なら null。 */
  withStatus(status: EvaluationTemplateStatus, now: string): EvaluationTemplate | null {
    if (this.canTransitionTo(status) === false) {
      return null
    }

    return new EvaluationTemplate({ ...this.props, status, updatedAt: now })
  }
}
