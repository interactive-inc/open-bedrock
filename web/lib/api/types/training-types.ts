// api/src/interface/training の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

export type TrainingCourseStatus = "active" | "archived"

export type TrainingEnrollmentStatus = "enrolled" | "completed"

// GET /training/courses の各要素、GET /training/courses/:code のレスポンス、
// POST /training/courses のレスポンスも同形（研修コース）。
export type TrainingCourseResponse = {
  id: number
  code: string
  title: string
  description: string | null
  duration_minutes: number | null
  category: string
  is_required: boolean
  status: TrainingCourseStatus
}

// GET /training/enrollments/me, GET /training/enrollments の各要素、
// POST /training/enrollments, POST /training/enrollments/:id/complete のレスポンスも同形（受講）。
export type TrainingEnrollmentResponse = {
  id: number
  course_id: number
  employee_id: number
  status: TrainingEnrollmentStatus
  completed_at: string | null
  score: number | null
  due_date: string | null
}

// POST /training/courses のリクエスト body（特権ロールが研修コースを作成する）。
export type TrainingCourseCreateRequest = {
  code: string
  title: string
  category: string
  description: string | null
  duration_minutes: number | null
  is_required: boolean
}

// POST /training/enrollments のリクエスト body（本人がコースの受講を申し込む）。
export type TrainingEnrollmentCreateRequest = {
  course_code: string
}
