// api/src/onboarding/*-response-schema.ts と同形の手書き type（API と疎結合に保つ）。
export type OnboardingKind = "join" | "leave"

export type OnboardingTaskStatus = "pending" | "done"

export type OnboardingAssignmentStatus = "in_progress" | "completed"

// GET /onboarding/templates の各要素。
// kind は hc レスポンス（api 実型）が string のため、props 型側も string に合わせる。
export type OnboardingTemplate = {
  code: string
  name: string
  kind: string
  description: string | null
  task_count: number
}

// GET /onboarding/me / 各 assignment 配下のタスク。
export type OnboardingTask = {
  id: number
  template_task_code: string
  title: string
  order: number
  status: OnboardingTaskStatus
  completed_at: string | null
}

// POST /onboarding/assign / GET /onboarding/employee/:code の各要素。
export type OnboardingAssignment = {
  id: number
  employee_code: string
  employee_name: string
  template_code: string
  template_name: string
  kind: OnboardingKind
  status: OnboardingAssignmentStatus
  assigned_at: string
  tasks: ReadonlyArray<OnboardingTask>
}
