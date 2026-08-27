/** api/src/goal/goal-schema.ts と同形。 */
export type Goal = {
  id: number
  employeeId: string
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

/** api/src/goal/goal-evaluation-schema.ts と同形。kind は self|manager|final。 */
export type GoalEvaluation = {
  id: number
  goalId: number
  evaluatorId: string
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  createdAt: string
}

/** 評価の種別。self=自己評価 / manager=上長評価 / final=確定評価。 */
export type GoalEvaluationKind = "self" | "manager" | "final"

/** GET /performance-goals のクエリ。未指定は本人の目標を返す。 */
export type GoalSearchQuery = {
  period: string | null
  employeeId: string | null
}

/**
 * GET /performance-goals/:goalId と PUT /performance-goals/:goalId のレスポンス。api は snake_case で返す。
 * id は api の型上 number | null になりうる。
 */
export type GoalResponse = {
  id: number | null
  employee_id: string
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

/**
 * POST /performance-goals のリクエストボディ。weight 未指定時は api 側で 10 が入る。kpi は未指定可。
 * 目標の所有主体。individual=個人 / department=部門 / company=全社。
 */
export type GoalOwnerType = "individual" | "department" | "company"

export type GoalCreateRequest = {
  period: string
  title: string
  weight?: number
  kpi?: string
  owner_type?: GoalOwnerType
  department_code?: string
  parent_goal_id?: number
}

/** PUT /performance-goals/:goalId のリクエストボディ。 */
export type GoalUpdateRequest = {
  period: string
  title: string
  weight: number
  // api 側は .optional()（string | undefined）のため null ではなく省略可能にする。
  kpi?: string
}

/** POST /performance-goals/:goalId/evaluations のリクエストボディ。 */
export type GoalEvaluationCreateRequest = {
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
}
