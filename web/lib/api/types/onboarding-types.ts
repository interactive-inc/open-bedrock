/** api/src/onboarding/*-response-schema.ts と同形の手書き type（API と疎結合に保つ）。 */
export type OnboardingKind = "join" | "leave"

export type OnboardingTaskStatus = "pending" | "done"

export type OnboardingAssignmentStatus = "in_progress" | "completed"

/**
 * GET /onboarding-templates の各要素。
 * kind は hc レスポンス（api 実型）が string のため、props 型側も string に合わせる。
 */
export type OnboardingTemplate = {
  code: string
  name: string
  kind: string
  description: string | null
  task_count: number
  lifecycle_effect: "hire" | "retired" | null
}

/**
 * GET /onboarding-templates/:code のレスポンス、POST /onboarding-templates・PUT のレスポンスも同形。
 * id は作成/更新ルートが整形して返すため number、未採番の保険として null を含める。
 */
export type OnboardingTemplateDetail = {
  id: number | null
  code: string
  name: string
  kind: string
  description: string | null
}

/** POST /onboarding-templates のリクエスト body（管理権限がテンプレートを作成する）。 */
export type OnboardingTemplateCreateRequest = {
  code: string
  name: string
  kind: OnboardingKind
  description: string | null
}

/** PUT /onboarding-templates/:code のリクエスト body（code は変更されない）。 */
export type OnboardingTemplateUpdateRequest = {
  name: string
  kind: OnboardingKind
  description: string | null
}

/** GET /onboarding-assignments/me / 各 assignment 配下のタスク。 */
export type OnboardingTask = {
  id: number
  template_task_code: string
  title: string
  order: number
  status: OnboardingTaskStatus
  completed_at: string | null
}

/**
 * POST /onboarding-assignments / GET /onboarding-assignments/employees/:code の各要素。
 * template_name は assign(POST) / employee(GET一覧) には含まれるが、
 * assignments/:id の GET/PUT レスポンスには含まれないため任意とする。
 */
export type OnboardingAssignment = {
  id: number
  employee_code: string
  employee_name: string
  template_code: string
  template_name?: string
  kind: OnboardingKind
  status: OnboardingAssignmentStatus
  assigned_at: string
  tasks: ReadonlyArray<OnboardingTask>
}
