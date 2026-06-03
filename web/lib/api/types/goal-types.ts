// api/src/goal の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側からは import しない。

// api/src/goal/goal-schema.ts と同形。
export type Goal = {
  id: number
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

// api/src/goal/goal-evaluation-schema.ts と同形。kind は self|manager|final。
export type GoalEvaluation = {
  id: number
  goalId: number
  evaluatorId: number
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  createdAt: string
}

// 評価の種別。self=自己評価 / manager=上長評価 / final=確定評価。
export type GoalEvaluationKind = "self" | "manager" | "final"

// GET /goals のクエリ。未指定は本人の目標を返す。
export type GoalSearchQuery = {
  period: string | null
  employeeId: number | null
}

// GET /goals/:goalId と PUT /goals/:goalId のレスポンス。api は snake_case で返す。
// id は api の型上 number | null になりうる。
export type GoalResponse = {
  id: number | null
  employee_id: number
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

// POST /goals のリクエストボディ。weight 未指定時は api 側で 10 が入る。kpi は未指定可。
export type GoalCreateRequest = {
  period: string
  title: string
  weight?: number
  kpi?: string
}

// PUT /goals/:goalId のリクエストボディ。
export type GoalUpdateRequest = {
  period: string
  title: string
  weight: number
  // api 側は .optional()（string | undefined）のため null ではなく省略可能にする。
  kpi?: string
}

// POST /goals/:goalId/evaluations のリクエストボディ。
export type GoalEvaluationCreateRequest = {
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
}
