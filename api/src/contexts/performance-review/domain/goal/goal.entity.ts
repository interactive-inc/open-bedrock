import type { GoalRow } from "@/contexts/performance-review/infrastructure/schema/goal"
import { z } from "zod"

/** 目標の所有主体。individual は個人、department は部門、company は全社。 */
export const goalOwnerTypeSchema = z.enum(["individual", "department", "company"])

export type GoalOwnerType = z.infer<typeof goalOwnerTypeSchema>

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number().int().min(1).max(100),
  status: z.string(),
  ownerType: goalOwnerTypeSchema,
  parentGoalId: z.number().nullable(),
  departmentCode: z.string().nullable(),
  evaluationSheetId: z.number().nullable(),
})

type Props = z.infer<typeof zProps>

/** 目標（社員ごと・評価期間ごとの目標と重み・状態）。集約ルート。 */
export class Goal implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly period!: Props["period"]

  readonly title!: Props["title"]

  readonly kpi!: Props["kpi"]

  readonly weight!: Props["weight"]

  readonly status!: Props["status"]

  readonly ownerType!: Props["ownerType"]

  readonly parentGoalId!: Props["parentGoalId"]

  readonly departmentCode!: Props["departmentCode"]

  readonly evaluationSheetId!: Props["evaluationSheetId"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する目標を組み立てる。id は未採番、初期状態は draft。 */
  static create(props: {
    employeeId: number
    period: string
    title: string
    kpi: string | null
    weight: number
    ownerType?: GoalOwnerType
    parentGoalId?: number | null
    departmentCode?: string | null
    evaluationSheetId?: number | null
  }): Goal {
    return new Goal({
      id: null,
      employeeId: props.employeeId,
      period: props.period,
      title: props.title,
      kpi: props.kpi,
      weight: props.weight,
      status: "draft",
      ownerType: props.ownerType ?? "individual",
      parentGoalId: props.parentGoalId ?? null,
      departmentCode: props.departmentCode ?? null,
      evaluationSheetId: props.evaluationSheetId ?? null,
    })
  }

  static fromRow(row: GoalRow): Goal {
    return new Goal({
      id: row.id,
      employeeId: row.employeeId,
      period: row.period,
      title: row.title,
      kpi: row.kpi,
      weight: row.weight,
      status: row.status,
      ownerType: goalOwnerTypeSchema.parse(row.ownerType),
      parentGoalId: row.parentGoalId,
      departmentCode: row.departmentCode,
      evaluationSheetId: row.evaluationSheetId,
    })
  }

  withStatus(status: Props["status"]) {
    return new Goal({ ...this.props, status })
  }

  /** 目標の定義（期間・タイトル・KPI・重み）を差し替えた写しを返す。 */
  withDetails(props: {
    period: Props["period"]
    title: Props["title"]
    kpi: Props["kpi"]
    weight: Props["weight"]
  }) {
    return new Goal({
      ...this.props,
      period: props.period,
      title: props.title,
      kpi: props.kpi,
      weight: props.weight,
    })
  }
}
